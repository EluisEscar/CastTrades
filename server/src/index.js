import "dotenv/config";
import express from "express";
import cors from "cors";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

const signToken = (user) => {
  return jwt.sign(
    { sub: user.id, email: user.email, pernerNumber: user.pernerNumber },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};

const requireAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || "";
    const [scheme, token] = authHeader.split(" ");

    if (scheme !== "Bearer" || !token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
};

function timeToMinutes(time) {
  if (!time || !time.includes(":")) return null;

  const [hours, minutes] = time.split(":").map(Number);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;

  return hours * 60 + minutes;
}

function buildStartDateTime(date, time) {
  const d = new Date(`${date}T${time}:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isPastOrStarted(dateObj) {
  return dateObj.getTime() <= Date.now();
}

function subtractDays(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

const port = process.env.PORT || 4000;
const REQUESTS_LIMIT_DEFAULT = 50;
const REQUESTS_LIMIT_MAX = 100;
const INBOX_SECTION_LIMIT = 20;
const INBOX_BATCH_SIZE = INBOX_SECTION_LIMIT * 4;
const EXPIRED_REQUEST_RETENTION_DAYS = 7;
const CLOSED_REQUEST_RETENTION_DAYS = 30;
const NOTIFICATION_RETENTION_DAYS = 30;

function buildInboxNotificationWhere(userId, recentCutoff) {
  return {
    userId,
    createdAt: {
      gte: recentCutoff,
    },
    OR: [
      {
        type: "NEEDS_CONFIRMATION",
        readAt: null,
      },
      {
        type: "DECLINED_BY_YOU",
      },
      {
        type: {
          in: ["REQUEST_ACCEPTED", "REQUEST_REJECTED"],
        },
      },
    ],
  };
}

function buildInboxNotificationSelect() {
  return {
    id: true,
    type: true,
    createdAt: true,
    reasonCode: true,
    actorUser: {
      select: {
        id: true,
        firstName: true,
        lastName: true,
        pernerNumber: true,
      },
    },
    shiftRequest: {
      select: {
        id: true,
        status: true,
        startsAt: true,
        role: true,
        date: true,
        start: true,
        end: true,
        location: {
          select: {
            id: true,
            name: true,
            area: true,
            parkId: true,
          },
        },
      },
    },
  };
}

function partitionInboxNotifications(notifications, now) {
  const sections = {
    needsConfirmation: [],
    declinedByYou: [],
    updates: [],
  };

  for (const notification of notifications) {
    if (
      notification.type === "NEEDS_CONFIRMATION" &&
      sections.needsConfirmation.length < INBOX_SECTION_LIMIT
    ) {
      const isPendingRequest =
        notification.shiftRequest?.status === "PENDING" &&
        notification.shiftRequest?.startsAt > now;

      if (isPendingRequest) {
        sections.needsConfirmation.push(notification);
      }

      continue;
    }

    if (
      notification.type === "DECLINED_BY_YOU" &&
      sections.declinedByYou.length < INBOX_SECTION_LIMIT
    ) {
      sections.declinedByYou.push(notification);
      continue;
    }

    if (
      (notification.type === "REQUEST_ACCEPTED" ||
        notification.type === "REQUEST_REJECTED") &&
      sections.updates.length < INBOX_SECTION_LIMIT
    ) {
      sections.updates.push(notification);
    }
  }

  return sections;
}

function inboxSectionsAreFull(sections) {
  return (
    sections.needsConfirmation.length >= INBOX_SECTION_LIMIT &&
    sections.declinedByYou.length >= INBOX_SECTION_LIMIT &&
    sections.updates.length >= INBOX_SECTION_LIMIT
  );
}

async function loadInboxSections(userId, recentCutoff, now) {
  const sections = {
    needsConfirmation: [],
    declinedByYou: [],
    updates: [],
  };

  let skip = 0;

  while (!inboxSectionsAreFull(sections)) {
    const notifications = await prisma.notification.findMany({
      where: buildInboxNotificationWhere(userId, recentCutoff),
      select: buildInboxNotificationSelect(),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip,
      take: INBOX_BATCH_SIZE,
    });

    if (notifications.length === 0) {
      break;
    }

    const batchSections = partitionInboxNotifications(notifications, now);

    sections.needsConfirmation.push(
      ...batchSections.needsConfirmation.slice(
        0,
        INBOX_SECTION_LIMIT - sections.needsConfirmation.length
      )
    );
    sections.declinedByYou.push(
      ...batchSections.declinedByYou.slice(
        0,
        INBOX_SECTION_LIMIT - sections.declinedByYou.length
      )
    );
    sections.updates.push(
      ...batchSections.updates.slice(0, INBOX_SECTION_LIMIT - sections.updates.length)
    );

    if (notifications.length < INBOX_BATCH_SIZE) {
      break;
    }

    skip += notifications.length;
  }

  return sections;
}

// REGISTER
app.post("/auth/register", async (req, res) => {
  try {
    const { email, password, firstName, lastName, pernerNumber } = req.body ?? {};

    if (!email || !password || !firstName || !lastName || pernerNumber === undefined) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedFirstName = String(firstName).trim();
    const normalizedLastName = String(lastName).trim();
    const normalizedPernerNumber = String(pernerNumber).trim();

    if (!normalizedPernerNumber) {
      return res.status(400).json({ error: "Perner number is required" });
    }

    if (!/^\d+$/.test(normalizedPernerNumber)) {
      return res.status(400).json({ error: "Perner number must contain only digits" });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { email: normalizedEmail },
          { pernerNumber: normalizedPernerNumber },
        ],
      },
    });

    if (existing) {
      return res.status(409).json({ error: "Email or pernerNumber already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        firstName: normalizedFirstName,
        lastName: normalizedLastName,
        pernerNumber: normalizedPernerNumber,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        pernerNumber: true,
        createdAt: true,
      },
    });

    const token = signToken(user);
    return res.status(201).json({ user, token });
  } catch (err) {
    console.error("REGISTER ERROR:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
});

// LOGIN
app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body ?? {};

    if (!email || !password) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = signToken(user);

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        pernerNumber: user.pernerNumber,
      },
      token,
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// CREATE REQUEST
app.post("/requests", requireAuth, async (req, res) => {
  try {
    const { role, date, start, end, locationId } = req.body ?? {};

    if (!role || !date || !start || !end || !locationId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const startMinutes = timeToMinutes(start);
    const endMinutes = timeToMinutes(end);

    if (startMinutes === null || endMinutes === null) {
      return res.status(400).json({ error: "Invalid time format" });
    }

    if (start === end) {
      return res.status(400).json({
        error: "Start time and end time cannot be the same",
      });
    }

    const startsAt = buildStartDateTime(date, start);

    if (!startsAt) {
      return res.status(400).json({ error: "Invalid start date/time" });
    }

    if (isPastOrStarted(startsAt)) {
      return res.status(400).json({ error: "This shift has already started." });
    }

    const location = await prisma.location.findUnique({
      where: { id: locationId },
      include: {
        park: true,
      },
    });

    if (!location || !location.isActive) {
      return res.status(404).json({ error: "Location not found or inactive" });
    }

    const isOvernight = endMinutes < startMinutes;

    const shiftRequest = await prisma.shiftRequest.create({
      data: {
        role,
        date,
        start,
        end,
        isOvernight,
        startsAt,
        locationId,
        ownerId: req.user.sub,
      },
      include: {
        location: {
          include: {
            park: true,
          },
        },
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            pernerNumber: true,
            email: true,
          },
        },
      },
    });

    return res.status(201).json(shiftRequest);
  } catch (err) {
    console.error("CREATE REQUEST ERROR:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
});

// GET OPEN REQUESTS
app.get("/requests", requireAuth, async (req, res) => {
  try {
    const { parkId, area, date } = req.query;
    const limit = Math.min(
      Number(req.query.limit) || REQUESTS_LIMIT_DEFAULT,
      REQUESTS_LIMIT_MAX
    );

    const where = {
      status: "OPEN",
      startsAt: {
        gt: new Date(),
      },
    };

    if (date) {
      where.date = date;
    }

    if (parkId || area) {
      where.location = {};
      if (parkId) where.location.parkId = parkId;
      if (area) where.location.area = area;
    }

    const requests = await prisma.shiftRequest.findMany({
      where,
      include: {
        location: {
          include: {
            park: true,
          },
        },
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            pernerNumber: true,
          },
        },
        acceptedByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            pernerNumber: true,
          },
        },
      },
      orderBy: {
        startsAt: "asc",
      },
      take: limit,
    });

    return res.json(requests);
  } catch (err) {
    console.error("GET REQUESTS ERROR:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
});

// EDIT REQUEST
app.patch("/requests/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { role, date, start, end, locationId } = req.body ?? {};

    const existing = await prisma.shiftRequest.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ error: "Request not found" });
    }

    if (existing.ownerId !== req.user.sub) {
      return res.status(403).json({ error: "Not allowed" });
    }

    if (!role || !date || !start || !end || !locationId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const startMinutes = timeToMinutes(start);
    const endMinutes = timeToMinutes(end);

    if (startMinutes === null || endMinutes === null) {
      return res.status(400).json({ error: "Invalid time format" });
    }

    if (start === end) {
      return res.status(400).json({
        error: "Start time and end time cannot be the same",
      });
    }

    const startsAt = buildStartDateTime(date, start);

    if (!startsAt) {
      return res.status(400).json({ error: "Invalid start date/time" });
    }

    if (isPastOrStarted(startsAt)) {
      return res.status(400).json({ error: "This shift has already started." });
    }

    const location = await prisma.location.findUnique({
      where: { id: locationId },
      include: {
        park: true,
      },
    });

    if (!location || !location.isActive) {
      return res.status(404).json({ error: "Location not found or inactive" });
    }

    const isOvernight = endMinutes < startMinutes;

    const updated = await prisma.shiftRequest.update({
      where: { id },
      data: {
        role,
        date,
        start,
        end,
        isOvernight,
        startsAt,
        locationId,
      },
      include: {
        location: {
          include: {
            park: true,
          },
        },
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            pernerNumber: true,
          },
        },
      },
    });

    return res.json(updated);
  } catch (err) {
    console.error("UPDATE REQUEST ERROR:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
});

// ACCEPT REQUEST
app.post("/requests/:id/accept", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.sub;

    const existing = await prisma.shiftRequest.findUnique({
      where: { id },
      select: {
        id: true,
        ownerId: true,
      },
    });

    if (!existing) {
      return res.status(404).json({ error: "Request not found" });
    }

    if (existing.ownerId === userId) {
      return res.status(400).json({ error: "You cannot accept your own request" });
    }

    const result = await prisma.$transaction(async (tx) => {
      const claim = await tx.shiftRequest.updateMany({
        where: {
          id,
          status: "OPEN",
          acceptedByUserId: null,
          startsAt: {
            gt: new Date(),
          },
        },
        data: {
          status: "PENDING",
          acceptedByUserId: userId,
          pendingAt: new Date(),
        },
      });

      if (claim.count === 0) {
        return null;
      }

      await tx.notification.create({
        data: {
          type: "NEEDS_CONFIRMATION",
          userId: existing.ownerId,
          actorUserId: userId,
          shiftRequestId: id,
        },
      });

      return tx.shiftRequest.findUnique({
        where: { id },
        include: {
          location: {
            include: {
              park: true,
            },
          },
          owner: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              pernerNumber: true,
            },
          },
          acceptedByUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              pernerNumber: true,
            },
          },
        },
      });
    });

    if (!result) {
      return res.status(409).json({
        error: "This request is no longer available.",
      });
    }

    return res.json(result);
  } catch (err) {
    console.error("ACCEPT REQUEST ERROR:", err);
    return res.status(500).json({
      error: "Server error",
      details: err.message,
    });
  }
});

app.post("/requests/:id/owner-accept", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const ownerId = req.user.sub;

    const existing = await prisma.shiftRequest.findUnique({
      where: { id },
      select: {
        id: true,
        ownerId: true,
        acceptedByUserId: true,
      },
    });

    if (!existing) {
      return res.status(404).json({ error: "Request not found" });
    }

    if (existing.ownerId !== ownerId) {
      return res.status(403).json({ error: "Not allowed" });
    }

    if (!existing.acceptedByUserId) {
      return res.status(400).json({ error: "Request is not pending confirmation" });
    }

    const result = await prisma.$transaction(async (tx) => {
      const confirm = await tx.shiftRequest.updateMany({
        where: {
          id,
          ownerId,
          status: "PENDING",
          acceptedByUserId: existing.acceptedByUserId,
          startsAt: {
            gt: new Date(),
          },
        },
        data: {
          status: "ACCEPTED",
          acceptedAt: new Date(),
        },
      });

      if (confirm.count === 0) {
        return null;
      }

      await tx.notification.updateMany({
        where: {
          userId: ownerId,
          type: "NEEDS_CONFIRMATION",
          shiftRequestId: id,
          readAt: null,
        },
        data: {
          readAt: new Date(),
        },
      });

      await tx.notification.create({
        data: {
          type: "REQUEST_ACCEPTED",
          userId: existing.acceptedByUserId,
          actorUserId: ownerId,
          shiftRequestId: id,
        },
      });

      return tx.shiftRequest.findUnique({
        where: { id },
        include: {
          location: {
            include: {
              park: true,
            },
          },
          owner: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              pernerNumber: true,
            },
          },
          acceptedByUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              pernerNumber: true,
            },
          },
        },
      });
    });

    if (!result) {
      return res.status(409).json({
        error: "This request was already updated or has already started.",
      });
    }

    return res.json(result);
  } catch (err) {
    console.error("OWNER ACCEPT ERROR:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
});

app.post("/requests/:id/owner-reject", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const ownerId = req.user.sub;
    const { reasonCode, reopenShift } = req.body ?? {};

    const validReasons = ["OVERTIME_LIMIT", "INCORRECT_PERNER", "OTHER"];

    if (!reasonCode || !validReasons.includes(reasonCode)) {
      return res.status(400).json({ error: "Invalid reject reason" });
    }

    const existing = await prisma.shiftRequest.findUnique({
      where: { id },
      select: {
        id: true,
        ownerId: true,
        acceptedByUserId: true,
      },
    });

    if (!existing) {
      return res.status(404).json({ error: "Request not found" });
    }

    if (existing.ownerId !== ownerId) {
      return res.status(403).json({ error: "Not allowed" });
    }

    if (!existing.acceptedByUserId) {
      return res.status(400).json({ error: "Request is not pending confirmation" });
    }

    const pendingUserId = existing.acceptedByUserId;
    const nextStatus = reopenShift ? "OPEN" : "CANCELED";

    const result = await prisma.$transaction(async (tx) => {
      const reject = await tx.shiftRequest.updateMany({
        where: {
          id,
          ownerId,
          status: "PENDING",
          acceptedByUserId: pendingUserId,
          startsAt: {
            gt: new Date(),
          },
        },
        data: {
          status: nextStatus,
          acceptedByUserId: null,
          pendingAt: null,
          acceptedAt: null,
        },
      });

      if (reject.count === 0) {
        return null;
      }

      await tx.notification.updateMany({
        where: {
          userId: ownerId,
          type: "NEEDS_CONFIRMATION",
          shiftRequestId: id,
          readAt: null,
        },
        data: {
          readAt: new Date(),
        },
      });

      await tx.notification.create({
        data: {
          type: "REQUEST_REJECTED",
          userId: pendingUserId,
          actorUserId: ownerId,
          shiftRequestId: id,
          reasonCode,
        },
      });

      await tx.notification.create({
        data: {
          type: "DECLINED_BY_YOU",
          userId: ownerId,
          actorUserId: pendingUserId,
          shiftRequestId: id,
          reasonCode,
        },
      });

      return tx.shiftRequest.findUnique({
        where: { id },
        include: {
          location: {
            include: {
              park: true,
            },
          },
          owner: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              pernerNumber: true,
            },
          },
        },
      });
    });

    if (!result) {
      return res.status(409).json({
        error: "This request was already updated or has already started.",
      });
    }

    return res.json(result);
  } catch (err) {
    console.error("OWNER REJECT ERROR:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
});

// DELETE REQUEST
app.delete("/requests/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.shiftRequest.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ error: "Request not found" });
    }

    if (existing.ownerId !== req.user.sub) {
      return res.status(403).json({ error: "Not allowed" });
    }

    await prisma.shiftRequest.delete({
      where: { id },
    });

    return res.json({ success: true });
  } catch (err) {
    console.error("DELETE REQUEST ERROR:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
});

// ME
app.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.sub },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        pernerNumber: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json({ user });
  } catch (err) {
    console.error("ME ERROR:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

app.get("/parks", requireAuth, async (_req, res) => {
  try {
    const parks = await prisma.park.findMany({
      orderBy: {
        name: "asc",
      },
    });

    return res.json(parks);
  } catch (err) {
    console.error("GET PARKS ERROR:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
});

app.get("/locations", requireAuth, async (req, res) => {
  try {
    const { parkId, area } = req.query;

    const where = {
      isActive: true,
    };

    if (parkId) where.parkId = parkId;
    if (area) where.area = area;

    const locations = await prisma.location.findMany({
      where,
      orderBy: {
        name: "asc",
      },
    });

    return res.json(locations);
  } catch (err) {
    console.error("GET LOCATIONS ERROR:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
});

app.get("/inbox", requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub;
    const now = new Date();
    const recentCutoff = subtractDays(NOTIFICATION_RETENTION_DAYS);
    const { needsConfirmation, declinedByYou, updates } = await loadInboxSections(
      userId,
      recentCutoff,
      now
    );

    return res.json({
      needsConfirmation,
      declinedByYou,
      updates,
    });
  } catch (err) {
    console.error("GET INBOX ERROR:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
});

app.get("/health", (_req, res) => res.json({ ok: true }));

async function expireStartedRequests() {
  try {
    const result = await prisma.shiftRequest.updateMany({
      where: {
        status: {
          in: ["OPEN", "PENDING"],
        },
        startsAt: {
          lte: new Date(),
        },
      },
      data: {
        status: "EXPIRED",
        acceptedByUserId: null,
        pendingAt: null,
      },
    });

    if (result.count > 0) {
      console.log(`[cleanup] expired ${result.count} started requests`);
    }
  } catch (err) {
    console.error("EXPIRE STARTED REQUESTS ERROR:", err);
  }
}

async function deleteOldClosedRequests() {
  try {
    const oldExpiredCutoff = subtractDays(EXPIRED_REQUEST_RETENTION_DAYS);
    const oldClosedCutoff = subtractDays(CLOSED_REQUEST_RETENTION_DAYS);

    const result = await prisma.shiftRequest.deleteMany({
      where: {
        OR: [
          {
            status: "EXPIRED",
            startsAt: {
              lt: oldExpiredCutoff,
            },
          },
          {
            status: {
              in: ["ACCEPTED", "CANCELED"],
            },
            updatedAt: {
              lt: oldClosedCutoff,
            },
          },
        ],
      },
    });

    if (result.count > 0) {
      console.log(`[cleanup] deleted ${result.count} old closed requests`);
    }
  } catch (err) {
    console.error("DELETE OLD CLOSED REQUESTS ERROR:", err);
  }
}

async function deleteOldNotifications() {
  try {
    const cutoff = subtractDays(NOTIFICATION_RETENTION_DAYS);

    const result = await prisma.notification.deleteMany({
      where: {
        createdAt: {
          lt: cutoff,
        },
      },
    });

    if (result.count > 0) {
      console.log(`[cleanup] deleted ${result.count} old notifications`);
    }
  } catch (err) {
    console.error("DELETE OLD NOTIFICATIONS ERROR:", err);
  }
}

async function runCleanupJobs() {
  await expireStartedRequests();
  await deleteOldNotifications();
  await deleteOldClosedRequests();
}

runCleanupJobs().catch((err) => {
  console.error("INITIAL CLEANUP ERROR:", err);
});

setInterval(() => {
  runCleanupJobs().catch((err) => {
    console.error("SCHEDULED CLEANUP ERROR:", err);
  });
}, 5 * 60 * 1000);

app.listen(port, () => console.log(`API running on http://localhost:${port}`));
