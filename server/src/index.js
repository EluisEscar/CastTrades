import "dotenv/config";
import express from "express";
import cors from "cors";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import {
  assertAllowedKeys,
  assertRequiredEnv,
  clearAuthCookie,
  createCorsOptions,
  createRateLimiter,
  errorMiddleware,
  getAuthTokenFromRequest,
  getClientIp,
  normalizeArea,
  normalizeBoolean,
  normalizeDateString,
  normalizeEmail,
  normalizeEnum,
  normalizeIdentifier,
  normalizeLimit,
  normalizeName,
  normalizeOptionalText,
  normalizePassword,
  normalizePernerNumber,
  normalizeRole,
  normalizeText,
  normalizeTimeString,
  normalizeUuid,
  parseBooleanEnv,
  parseCookieSameSiteEnv,
  parseDurationEnv,
  parseIntegerEnv,
  requireJsonBody,
  securityHeaders,
  setAuthCookie,
  ValidationError,
} from "./security.js";

const app = express();
const prisma = new PrismaClient();

assertRequiredEnv(["DATABASE_URL", "JWT_SECRET"]);

const port = parseIntegerEnv(process.env.PORT, 4000, { min: 1, max: 65535 });
const REQUESTS_LIMIT_DEFAULT = 50;
const REQUESTS_LIMIT_MAX = 100;
const INBOX_SECTION_LIMIT = 20;
const INBOX_BATCH_SIZE = INBOX_SECTION_LIMIT * 4;
const EXPIRED_REQUEST_RETENTION_DAYS = 7;
const CLOSED_REQUEST_RETENTION_DAYS = 30;
const NOTIFICATION_RETENTION_DAYS = 30;
const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "casttrades_session";
const AUTH_COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
const AUTH_COOKIE_SECURE = parseBooleanEnv(process.env.AUTH_COOKIE_SECURE);
const AUTH_COOKIE_SAME_SITE = parseCookieSameSiteEnv(
  process.env.AUTH_COOKIE_SAME_SITE,
  "Lax"
);
const GENERAL_RATE_LIMIT_WINDOW_MS = parseDurationEnv(
  process.env.RATE_LIMIT_WINDOW_MS,
  15 * 60 * 1000
);
const GENERAL_RATE_LIMIT_MAX = parseIntegerEnv(process.env.RATE_LIMIT_MAX, 120, {
  min: 1,
  max: 10000,
});
const AUTH_RATE_LIMIT_WINDOW_MS = parseDurationEnv(
  process.env.AUTH_RATE_LIMIT_WINDOW_MS,
  15 * 60 * 1000
);
const AUTH_RATE_LIMIT_MAX = parseIntegerEnv(process.env.AUTH_RATE_LIMIT_MAX, 5, {
  min: 1,
  max: 100,
});
const allowedOrigins = new Set(
  (process.env.CORS_ALLOWED_ORIGINS ||
    "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
);
const REQUEST_REJECT_REASONS = ["OVERTIME_LIMIT", "INCORRECT_PERNER", "OTHER"];
const USER_ROLES = ["USER", "ADMIN", "SUPERADMIN"];
const ADMIN_ROLES = ["ADMIN", "SUPERADMIN"];
const ADMIN_EMAILS = new Set(
  (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
);

if (AUTH_COOKIE_SAME_SITE === "None" && !AUTH_COOKIE_SECURE) {
  throw new Error("AUTH_COOKIE_SECURE must be true when AUTH_COOKIE_SAME_SITE=None");
}

app.set("trust proxy", parseIntegerEnv(process.env.TRUST_PROXY, 1, { min: 0, max: 10 }));
app.use(securityHeaders);
app.use(cors(createCorsOptions(allowedOrigins)));
app.use(
  express.json({
    limit: process.env.BODY_SIZE_LIMIT || "16kb",
    strict: true,
  })
);

const generalRateLimiter = createRateLimiter({
  name: "global",
  windowMs: GENERAL_RATE_LIMIT_WINDOW_MS,
  max: GENERAL_RATE_LIMIT_MAX,
  keyBuilder: (req) => getClientIp(req),
});

const authRateLimiter = createRateLimiter({
  name: "auth",
  windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
  max: AUTH_RATE_LIMIT_MAX,
  keyBuilder: (req) => {
    const identifierSource =
      typeof req.body?.email === "string"
        ? req.body.email
        : typeof req.body?.pernerNumber === "string"
          ? req.body.pernerNumber
          : "";
    const identifier = identifierSource.trim().toLowerCase() || "anonymous";
    return `${getClientIp(req)}:${req.path}:${identifier}`;
  },
});

app.use(generalRateLimiter);

const signToken = (user) => {
  return jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: "7d" });
};

function isBootstrapAdminEmail(email) {
  return ADMIN_EMAILS.has(String(email || "").trim().toLowerCase());
}

function getUserSessionSelect() {
  return {
    id: true,
    email: true,
    firstName: true,
    lastName: true,
    pernerNumber: true,
    role: true,
    isActive: true,
    createdAt: true,
  };
}

async function maybePromoteBootstrapAdmin(user) {
  if (!user || !isBootstrapAdminEmail(user.email) || ADMIN_ROLES.includes(user.role)) {
    return user;
  }

  return prisma.user.update({
    where: { id: user.id },
    data: {
      role: "ADMIN",
    },
    select: getUserSessionSelect(),
  });
}

const requireAuth = async (req, res, next) => {
  try {
    const token = getAuthTokenFromRequest(req, AUTH_COOKIE_NAME);

    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    let user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: getUserSessionSelect(),
    });

    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    user = await maybePromoteBootstrapAdmin(user);

    if (!user.isActive) {
      return res.status(403).json({ error: "Account disabled" });
    }

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
};

function requireAdmin(req, res, next) {
  if (!req.user || !ADMIN_ROLES.includes(req.user.role)) {
    return res.status(403).json({ error: "Admin access required" });
  }

  return next();
}

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

function parseRegisterPayload(body) {
  assertAllowedKeys(body, ["email", "password", "firstName", "lastName", "pernerNumber"]);

  return {
    email: normalizeEmail(body.email),
    password: normalizePassword(body.password),
    firstName: normalizeName(body.firstName, "firstName"),
    lastName: normalizeName(body.lastName, "lastName"),
    pernerNumber: normalizePernerNumber(body.pernerNumber),
  };
}

function parseLoginPayload(body) {
  assertAllowedKeys(body, ["email", "password"]);

  return {
    email: normalizeEmail(body.email),
    password: normalizeText(body.password, {
      field: "password",
      minLength: 1,
      maxLength: 72,
      trim: false,
    }),
  };
}

function parseSelfUpdatePayload(body) {
  assertAllowedKeys(body, ["email", "pernerNumber"]);

  const payload = {
    email: body.email === undefined ? undefined : normalizeEmail(body.email),
    pernerNumber:
      body.pernerNumber === undefined
        ? undefined
        : normalizePernerNumber(body.pernerNumber),
  };

  ensureAtLeastOneField(payload, ["email", "pernerNumber"]);
  return payload;
}

function parseShiftPayload(body) {
  assertAllowedKeys(body, ["role", "date", "start", "end", "locationId"]);

  return {
    role: normalizeRole(body.role),
    date: normalizeDateString(body.date),
    start: normalizeTimeString(body.start, "start"),
    end: normalizeTimeString(body.end, "end"),
    locationId: normalizeIdentifier(body.locationId, "locationId", 120),
  };
}

function parseRejectPayload(body) {
  assertAllowedKeys(body, ["reasonCode", "reopenShift"]);

  return {
    reasonCode: normalizeEnum(body.reasonCode, REQUEST_REJECT_REASONS, "reasonCode"),
    reopenShift: normalizeBoolean(body.reopenShift, "reopenShift"),
  };
}

function parseRequestFilters(query) {
  return {
    parkId:
      query.parkId === undefined
        ? undefined
        : normalizeIdentifier(query.parkId, "parkId", 80),
    area: query.area === undefined ? undefined : normalizeArea(query.area),
    date: query.date === undefined ? undefined : normalizeDateString(query.date),
    limit: normalizeLimit(query.limit, REQUESTS_LIMIT_DEFAULT, REQUESTS_LIMIT_MAX),
  };
}

function parseLocationFilters(query) {
  return {
    parkId:
      query.parkId === undefined
        ? undefined
        : normalizeIdentifier(query.parkId, "parkId", 80),
    area: query.area === undefined ? undefined : normalizeArea(query.area),
  };
}

function parseRequestId(params) {
  return normalizeUuid(params.id, "id");
}

function parseOptionalBooleanQuery(value, field) {
  if (value === undefined) {
    return undefined;
  }

  const normalizedValue = String(value).trim().toLowerCase();

  if (normalizedValue === "true") return true;
  if (normalizedValue === "false") return false;

  throw new ValidationError(`${field} must be true or false`);
}

function ensureAtLeastOneField(payload, fields) {
  if (!fields.some((field) => payload[field] !== undefined)) {
    throw new ValidationError("At least one field is required");
  }
}

function parseAdminUserUpdatePayload(body) {
  assertAllowedKeys(body, ["role", "isActive"]);

  const payload = {
    role: body.role === undefined ? undefined : normalizeEnum(body.role, USER_ROLES, "role"),
    isActive:
      body.isActive === undefined ? undefined : normalizeBoolean(body.isActive, "isActive"),
  };

  ensureAtLeastOneField(payload, ["role", "isActive"]);
  return payload;
}

function parseAdminParkCreatePayload(body) {
  assertAllowedKeys(body, ["id", "name", "isActive"]);

  return {
    id: normalizeIdentifier(body.id, "id", 120),
    name: normalizeText(body.name, {
      field: "name",
      minLength: 2,
      maxLength: 120,
      pattern: /^[A-Za-z0-9À-ÿ'&(). -]+$/,
    }),
    isActive:
      body.isActive === undefined ? true : normalizeBoolean(body.isActive, "isActive"),
  };
}

function parseAdminParkUpdatePayload(body) {
  assertAllowedKeys(body, ["name", "isActive"]);

  const payload = {
    name: normalizeOptionalText(body.name, {
      field: "name",
      minLength: 2,
      maxLength: 120,
      pattern: /^[A-Za-z0-9À-ÿ'&(). -]+$/,
    }),
    isActive:
      body.isActive === undefined ? undefined : normalizeBoolean(body.isActive, "isActive"),
  };

  ensureAtLeastOneField(payload, ["name", "isActive"]);
  return payload;
}

function parseAdminLocationCreatePayload(body) {
  assertAllowedKeys(body, ["id", "name", "parkId", "area", "isActive"]);

  return {
    id: normalizeIdentifier(body.id, "id", 120),
    name: normalizeText(body.name, {
      field: "name",
      minLength: 2,
      maxLength: 120,
      pattern: /^[A-Za-z0-9À-ÿ'&(). -]+$/,
    }),
    parkId: normalizeIdentifier(body.parkId, "parkId", 120),
    area: normalizeArea(body.area),
    isActive:
      body.isActive === undefined ? true : normalizeBoolean(body.isActive, "isActive"),
  };
}

function parseAdminLocationUpdatePayload(body) {
  assertAllowedKeys(body, ["name", "parkId", "area", "isActive"]);

  const payload = {
    name: normalizeOptionalText(body.name, {
      field: "name",
      minLength: 2,
      maxLength: 120,
      pattern: /^[A-Za-z0-9À-ÿ'&(). -]+$/,
    }),
    parkId:
      body.parkId === undefined
        ? undefined
        : normalizeIdentifier(body.parkId, "parkId", 120),
    area: body.area === undefined ? undefined : normalizeArea(body.area),
    isActive:
      body.isActive === undefined ? undefined : normalizeBoolean(body.isActive, "isActive"),
  };

  ensureAtLeastOneField(payload, ["name", "parkId", "area", "isActive"]);
  return payload;
}

function parseAdminRequestUpdatePayload(body) {
  assertAllowedKeys(body, ["status"]);

  const payload = {
    status: normalizeEnum(body.status, ["OPEN", "CANCELED"], "status"),
  };

  return payload;
}

function parseAdminListLimit(query, fallback = 100, max = 200) {
  return normalizeLimit(query.limit, fallback, max);
}

function getAdminUserSelect() {
  return {
    id: true,
    email: true,
    firstName: true,
    lastName: true,
    pernerNumber: true,
    role: true,
    isActive: true,
    _count: {
      select: {
        ownedRequests: true,
      },
    },
  };
}

function getAdminParkSelect() {
  return {
    id: true,
    name: true,
    isActive: true,
    _count: {
      select: {
        locations: true,
      },
    },
  };
}

function getAdminLocationSelect() {
  return {
    id: true,
    name: true,
    area: true,
    isActive: true,
    parkId: true,
    park: {
      select: {
        id: true,
        name: true,
      },
    },
    _count: {
      select: {
        requests: true,
      },
    },
  };
}

function getAdminRequestUserSelect() {
  return {
    id: true,
    firstName: true,
    lastName: true,
    pernerNumber: true,
    email: true,
  };
}

function getAdminRequestSelect() {
  return {
    id: true,
    status: true,
    role: true,
    date: true,
    start: true,
    end: true,
    location: {
      select: {
        id: true,
        name: true,
        park: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    },
    owner: {
      select: getAdminRequestUserSelect(),
    },
    acceptedByUser: {
      select: getAdminRequestUserSelect(),
    },
  };
}

function getAdminAuditLogSelect() {
  return {
    id: true,
    action: true,
    entityType: true,
    entityId: true,
    createdAt: true,
    actorUser: {
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
      },
    },
  };
}

async function writeAuditLog(tx, { actorUserId, action, entityType, entityId, details }) {
  await tx.auditLog.create({
    data: {
      actorUserId,
      action,
      entityType,
      entityId,
      details,
    },
  });
}

function respondWithRouteError(res, label, err) {
  if (err?.name === "ValidationError") {
    return res.status(err.status || 400).json({ error: err.message });
  }

  console.error(label, err);
  return res.status(500).json({ error: "Server error" });
}

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
app.post("/auth/register", authRateLimiter, requireJsonBody, async (req, res) => {
  try {
    const { email, password, firstName, lastName, pernerNumber } = parseRegisterPayload(
      req.body
    );

    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { pernerNumber },
        ],
      },
    });

    if (existing) {
      return res.status(409).json({ error: "Email or pernerNumber already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName,
        lastName,
        pernerNumber,
        role: isBootstrapAdminEmail(email) ? "ADMIN" : "USER",
      },
      select: getUserSessionSelect(),
    });

    const token = signToken(user);
    setAuthCookie(res, token, {
      cookieName: AUTH_COOKIE_NAME,
      maxAgeSeconds: AUTH_COOKIE_MAX_AGE_SECONDS,
      secure: AUTH_COOKIE_SECURE,
      sameSite: AUTH_COOKIE_SAME_SITE,
    });

    return res.status(201).json({ user });
  } catch (err) {
    return respondWithRouteError(res, "REGISTER ERROR:", err);
  }
});

// LOGIN
app.post("/auth/login", authRateLimiter, requireJsonBody, async (req, res) => {
  try {
    const { email, password } = parseLoginPayload(req.body);

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        pernerNumber: true,
        passwordHash: true,
        role: true,
        isActive: true,
      },
    });

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: "Account disabled" });
    }

    const sessionUser = await maybePromoteBootstrapAdmin(user);
    const token = signToken(sessionUser);
    setAuthCookie(res, token, {
      cookieName: AUTH_COOKIE_NAME,
      maxAgeSeconds: AUTH_COOKIE_MAX_AGE_SECONDS,
      secure: AUTH_COOKIE_SECURE,
      sameSite: AUTH_COOKIE_SAME_SITE,
    });

    return res.json({
      user: {
        id: sessionUser.id,
        email: sessionUser.email,
        firstName: sessionUser.firstName,
        lastName: sessionUser.lastName,
        pernerNumber: sessionUser.pernerNumber,
        role: sessionUser.role,
        isActive: sessionUser.isActive,
      },
    });
  } catch (err) {
    return respondWithRouteError(res, "LOGIN ERROR:", err);
  }
});

app.post("/auth/logout", (_req, res) => {
  clearAuthCookie(res, {
    cookieName: AUTH_COOKIE_NAME,
    secure: AUTH_COOKIE_SECURE,
    sameSite: AUTH_COOKIE_SAME_SITE,
  });

  return res.json({ success: true });
});

// CREATE REQUEST
app.post("/requests", requireAuth, requireJsonBody, async (req, res) => {
  try {
    const { role, date, start, end, locationId } = parseShiftPayload(req.body);

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

    if (!location || !location.isActive || !location.park?.isActive) {
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
        ownerId: req.user.id,
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
    return respondWithRouteError(res, "CREATE REQUEST ERROR:", err);
  }
});

// GET OPEN REQUESTS
app.get("/requests", requireAuth, async (req, res) => {
  try {
    const { parkId, area, date, limit } = parseRequestFilters(req.query);

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
    return respondWithRouteError(res, "GET REQUESTS ERROR:", err);
  }
});

// EDIT REQUEST
app.patch("/requests/:id", requireAuth, requireJsonBody, async (req, res) => {
  try {
    const id = parseRequestId(req.params);
    const { role, date, start, end, locationId } = parseShiftPayload(req.body);

    const existing = await prisma.shiftRequest.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ error: "Request not found" });
    }

    if (existing.ownerId !== req.user.id) {
      return res.status(403).json({ error: "Not allowed" });
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

    if (!location || !location.isActive || !location.park?.isActive) {
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
    return respondWithRouteError(res, "UPDATE REQUEST ERROR:", err);
  }
});

// ACCEPT REQUEST
app.post("/requests/:id/accept", requireAuth, async (req, res) => {
  try {
    const id = parseRequestId(req.params);
    const userId = req.user.id;

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
    return respondWithRouteError(res, "ACCEPT REQUEST ERROR:", err);
  }
});

app.post("/requests/:id/owner-accept", requireAuth, async (req, res) => {
  try {
    const id = parseRequestId(req.params);
    const ownerId = req.user.id;

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
    return respondWithRouteError(res, "OWNER ACCEPT ERROR:", err);
  }
});

app.post("/requests/:id/owner-reject", requireAuth, requireJsonBody, async (req, res) => {
  try {
    const id = parseRequestId(req.params);
    const ownerId = req.user.id;
    const { reasonCode, reopenShift } = parseRejectPayload(req.body);

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
    return respondWithRouteError(res, "OWNER REJECT ERROR:", err);
  }
});

// DELETE REQUEST
app.delete("/requests/:id", requireAuth, async (req, res) => {
  try {
    const id = parseRequestId(req.params);

    const existing = await prisma.shiftRequest.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ error: "Request not found" });
    }

    if (existing.ownerId !== req.user.id) {
      return res.status(403).json({ error: "Not allowed" });
    }

    await prisma.shiftRequest.delete({
      where: { id },
    });

    return res.json({ success: true });
  } catch (err) {
    return respondWithRouteError(res, "DELETE REQUEST ERROR:", err);
  }
});

// ME
app.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: getUserSessionSelect(),
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json({ user });
  } catch (err) {
    return respondWithRouteError(res, "ME ERROR:", err);
  }
});

app.patch("/me", requireAuth, requireJsonBody, async (req, res) => {
  try {
    const payload = parseSelfUpdatePayload(req.body);

    const existingUser = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: getUserSessionSelect(),
    });

    if (!existingUser) {
      return res.status(404).json({ error: "User not found" });
    }

    if (payload.email !== undefined && payload.email !== existingUser.email) {
      const userWithEmail = await prisma.user.findUnique({
        where: { email: payload.email },
        select: { id: true },
      });

      if (userWithEmail) {
        return res.status(409).json({ error: "Email already exists" });
      }
    }

    if (
      payload.pernerNumber !== undefined &&
      payload.pernerNumber !== existingUser.pernerNumber
    ) {
      const userWithPerner = await prisma.user.findUnique({
        where: { pernerNumber: payload.pernerNumber },
        select: { id: true },
      });

      if (userWithPerner) {
        return res.status(409).json({ error: "Perner number already exists" });
      }
    }

    let user = existingUser;

    if (
      (payload.email !== undefined && payload.email !== existingUser.email) ||
      (payload.pernerNumber !== undefined &&
        payload.pernerNumber !== existingUser.pernerNumber)
    ) {
      user = await prisma.user.update({
        where: { id: req.user.id },
        data: {
          ...(payload.email !== undefined ? { email: payload.email } : {}),
          ...(payload.pernerNumber !== undefined
            ? { pernerNumber: payload.pernerNumber }
            : {}),
        },
        select: getUserSessionSelect(),
      });

      user = await maybePromoteBootstrapAdmin(user);
    }

    return res.json({ user });
  } catch (err) {
    return respondWithRouteError(res, "UPDATE ME ERROR:", err);
  }
});

app.get("/parks", requireAuth, async (_req, res) => {
  try {
    const parks = await prisma.park.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    return res.json(parks);
  } catch (err) {
    return respondWithRouteError(res, "GET PARKS ERROR:", err);
  }
});

app.get("/locations", requireAuth, async (req, res) => {
  try {
    const { parkId, area } = parseLocationFilters(req.query);

    const where = {
      isActive: true,
      park: {
        isActive: true,
      },
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
    return respondWithRouteError(res, "GET LOCATIONS ERROR:", err);
  }
});

app.get("/inbox", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
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
    return respondWithRouteError(res, "GET INBOX ERROR:", err);
  }
});

app.get("/admin/overview", requireAuth, requireAdmin, async (req, res) => {
  try {
    const recentCutoff = subtractDays(7);

    const [
      totalUsers,
      activeUsers,
      adminUsers,
      totalParks,
      activeParks,
      totalLocations,
      activeLocations,
      openRequests,
      pendingRequests,
      acceptedRequests,
      recentRequests,
    ] = await prisma.$transaction([
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.user.count({ where: { role: { in: ADMIN_ROLES } } }),
      prisma.park.count(),
      prisma.park.count({ where: { isActive: true } }),
      prisma.location.count(),
      prisma.location.count({ where: { isActive: true } }),
      prisma.shiftRequest.count({ where: { status: "OPEN" } }),
      prisma.shiftRequest.count({ where: { status: "PENDING" } }),
      prisma.shiftRequest.count({ where: { status: "ACCEPTED" } }),
      prisma.shiftRequest.count({
        where: {
          createdAt: {
            gte: recentCutoff,
          },
        },
      }),
    ]);

    return res.json({
      users: {
        total: totalUsers,
        active: activeUsers,
        admins: adminUsers,
      },
      parks: {
        total: totalParks,
        active: activeParks,
      },
      locations: {
        total: totalLocations,
        active: activeLocations,
      },
      requests: {
        open: openRequests,
        pending: pendingRequests,
        accepted: acceptedRequests,
        last7Days: recentRequests,
      },
    });
  } catch (err) {
    return respondWithRouteError(res, "ADMIN OVERVIEW ERROR:", err);
  }
});

app.get("/admin/users", requireAuth, requireAdmin, async (req, res) => {
  try {
    const limit = parseAdminListLimit(req.query, 50, 200);
    const role =
      req.query.role === undefined
        ? undefined
        : normalizeEnum(req.query.role, USER_ROLES, "role");
    const isActive = parseOptionalBooleanQuery(req.query.isActive, "isActive");
    const q = normalizeOptionalText(req.query.q, {
      field: "q",
      minLength: 1,
      maxLength: 120,
      pattern: /^[A-Za-z0-9À-ÿ@._'()\-\/& ]+$/,
    });

    const where = {};

    if (role) where.role = role;
    if (isActive !== undefined) where.isActive = isActive;
    if (q) {
      where.OR = [
        { email: { contains: q, mode: "insensitive" } },
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { pernerNumber: { contains: q, mode: "insensitive" } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      take: limit,
      select: getAdminUserSelect(),
    });

    return res.json(users);
  } catch (err) {
    return respondWithRouteError(res, "ADMIN USERS ERROR:", err);
  }
});

app.patch("/admin/users/:id", requireAuth, requireAdmin, requireJsonBody, async (req, res) => {
  try {
    const id = parseRequestId(req.params);
    const payload = parseAdminUserUpdatePayload(req.body);

    const existing = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    if (!existing) {
      return res.status(404).json({ error: "User not found" });
    }

    if (req.user.id === id && payload.isActive === false) {
      return res.status(400).json({ error: "You cannot deactivate your own account" });
    }

    if (req.user.id === id && payload.role && payload.role !== existing.role) {
      return res.status(400).json({ error: "You cannot change your own role" });
    }

    if (
      req.user.role !== "SUPERADMIN" &&
      (existing.role === "SUPERADMIN" || payload.role === "SUPERADMIN")
    ) {
      return res.status(403).json({ error: "Only a superadmin can manage superadmin accounts" });
    }

    const updatedUser = await prisma.$transaction(async (tx) => {
      const nextUser = await tx.user.update({
        where: { id },
        data: payload,
        select: getAdminUserSelect(),
      });

      let action = "UPDATE";
      if (payload.role && payload.role !== existing.role) {
        action = "ROLE_CHANGE";
      } else if (payload.isActive === true && existing.isActive === false) {
        action = "ACTIVATE";
      } else if (payload.isActive === false && existing.isActive === true) {
        action = "DEACTIVATE";
      }

      await writeAuditLog(tx, {
        actorUserId: req.user.id,
        action,
        entityType: "USER",
        entityId: id,
        details: {
          previous: existing,
          next: {
            role: nextUser.role,
            isActive: nextUser.isActive,
          },
        },
      });

      return nextUser;
    });

    return res.json(updatedUser);
  } catch (err) {
    return respondWithRouteError(res, "ADMIN UPDATE USER ERROR:", err);
  }
});

app.get("/admin/parks", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const parks = await prisma.park.findMany({
      orderBy: [{ name: "asc" }],
      select: getAdminParkSelect(),
    });

    return res.json(parks);
  } catch (err) {
    return respondWithRouteError(res, "ADMIN PARKS ERROR:", err);
  }
});

app.post("/admin/parks", requireAuth, requireAdmin, requireJsonBody, async (req, res) => {
  try {
    const payload = parseAdminParkCreatePayload(req.body);

    const existing = await prisma.park.findFirst({
      where: {
        OR: [{ id: payload.id }, { name: payload.name }],
      },
    });

    if (existing) {
      return res.status(409).json({ error: "Park id or name already exists" });
    }

    const park = await prisma.$transaction(async (tx) => {
      const created = await tx.park.create({
        data: payload,
        select: getAdminParkSelect(),
      });

      await writeAuditLog(tx, {
        actorUserId: req.user.id,
        action: "CREATE",
        entityType: "PARK",
        entityId: created.id,
        details: payload,
      });

      return created;
    });

    return res.status(201).json(park);
  } catch (err) {
    return respondWithRouteError(res, "ADMIN CREATE PARK ERROR:", err);
  }
});

app.patch("/admin/parks/:id", requireAuth, requireAdmin, requireJsonBody, async (req, res) => {
  try {
    const id = normalizeIdentifier(req.params.id, "id", 120);
    const payload = parseAdminParkUpdatePayload(req.body);

    const existing = await prisma.park.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ error: "Park not found" });
    }

    if (payload.name && payload.name !== existing.name) {
      const duplicate = await prisma.park.findFirst({
        where: {
          name: payload.name,
          id: {
            not: id,
          },
        },
      });

      if (duplicate) {
        return res.status(409).json({ error: "Park name already exists" });
      }
    }

    const park = await prisma.$transaction(async (tx) => {
      const updated = await tx.park.update({
        where: { id },
        data: payload,
        select: getAdminParkSelect(),
      });

      let action = "UPDATE";
      if (payload.isActive === true && existing.isActive === false) {
        action = "ACTIVATE";
      } else if (payload.isActive === false && existing.isActive === true) {
        action = "DEACTIVATE";
      }

      await writeAuditLog(tx, {
        actorUserId: req.user.id,
        action,
        entityType: "PARK",
        entityId: id,
        details: {
          previous: existing,
          next: payload,
        },
      });

      return updated;
    });

    return res.json(park);
  } catch (err) {
    return respondWithRouteError(res, "ADMIN UPDATE PARK ERROR:", err);
  }
});

app.get("/admin/locations", requireAuth, requireAdmin, async (req, res) => {
  try {
    const limit = parseAdminListLimit(req.query, 100, 250);
    const parkId =
      req.query.parkId === undefined
        ? undefined
        : normalizeIdentifier(req.query.parkId, "parkId", 120);
    const area = req.query.area === undefined ? undefined : normalizeArea(req.query.area);
    const isActive = parseOptionalBooleanQuery(req.query.isActive, "isActive");

    const where = {};
    if (parkId) where.parkId = parkId;
    if (area) where.area = area;
    if (isActive !== undefined) where.isActive = isActive;

    const locations = await prisma.location.findMany({
      where,
      take: limit,
      orderBy: [{ updatedAt: "desc" }],
      select: getAdminLocationSelect(),
    });

    return res.json(locations);
  } catch (err) {
    return respondWithRouteError(res, "ADMIN LOCATIONS ERROR:", err);
  }
});

app.post("/admin/locations", requireAuth, requireAdmin, requireJsonBody, async (req, res) => {
  try {
    const payload = parseAdminLocationCreatePayload(req.body);

    const park = await prisma.park.findUnique({
      where: { id: payload.parkId },
    });

    if (!park) {
      return res.status(404).json({ error: "Park not found" });
    }

    const existing = await prisma.location.findFirst({
      where: {
        OR: [
          { id: payload.id },
          {
            parkId: payload.parkId,
            area: payload.area,
            name: payload.name,
          },
        ],
      },
    });

    if (existing) {
      return res.status(409).json({ error: "Location id or name already exists" });
    }

    const location = await prisma.$transaction(async (tx) => {
      const created = await tx.location.create({
        data: payload,
        select: getAdminLocationSelect(),
      });

      await writeAuditLog(tx, {
        actorUserId: req.user.id,
        action: "CREATE",
        entityType: "LOCATION",
        entityId: created.id,
        details: payload,
      });

      return created;
    });

    return res.status(201).json(location);
  } catch (err) {
    return respondWithRouteError(res, "ADMIN CREATE LOCATION ERROR:", err);
  }
});

app.patch(
  "/admin/locations/:id",
  requireAuth,
  requireAdmin,
  requireJsonBody,
  async (req, res) => {
    try {
      const id = normalizeIdentifier(req.params.id, "id", 120);
      const payload = parseAdminLocationUpdatePayload(req.body);

      const existing = await prisma.location.findUnique({
        where: { id },
      });

      if (!existing) {
        return res.status(404).json({ error: "Location not found" });
      }

      const nextParkId = payload.parkId || existing.parkId;
      const nextArea = payload.area || existing.area;
      const nextName = payload.name || existing.name;

      if (payload.parkId) {
        const park = await prisma.park.findUnique({
          where: { id: payload.parkId },
        });

        if (!park) {
          return res.status(404).json({ error: "Park not found" });
        }
      }

      const duplicate = await prisma.location.findFirst({
        where: {
          id: {
            not: id,
          },
          parkId: nextParkId,
          area: nextArea,
          name: nextName,
        },
      });

      if (duplicate) {
        return res.status(409).json({ error: "Location name already exists in that park and area" });
      }

      const location = await prisma.$transaction(async (tx) => {
        const updated = await tx.location.update({
          where: { id },
          data: payload,
          select: getAdminLocationSelect(),
        });

        let action = "UPDATE";
        if (payload.isActive === true && existing.isActive === false) {
          action = "ACTIVATE";
        } else if (payload.isActive === false && existing.isActive === true) {
          action = "DEACTIVATE";
        }

        await writeAuditLog(tx, {
          actorUserId: req.user.id,
          action,
          entityType: "LOCATION",
          entityId: id,
          details: {
            previous: existing,
            next: payload,
          },
        });

        return updated;
      });

      return res.json(location);
    } catch (err) {
      return respondWithRouteError(res, "ADMIN UPDATE LOCATION ERROR:", err);
    }
  }
);

app.get("/admin/requests", requireAuth, requireAdmin, async (req, res) => {
  try {
    const limit = parseAdminListLimit(req.query, 100, 250);
    const parkId =
      req.query.parkId === undefined
        ? undefined
        : normalizeIdentifier(req.query.parkId, "parkId", 120);
    const area = req.query.area === undefined ? undefined : normalizeArea(req.query.area);
    const date = req.query.date === undefined ? undefined : normalizeDateString(req.query.date);
    const status =
      req.query.status === undefined
        ? undefined
        : normalizeEnum(
            req.query.status,
            ["OPEN", "PENDING", "ACCEPTED", "CANCELED", "EXPIRED"],
            "status"
          );
    const ownerId =
      req.query.ownerId === undefined ? undefined : normalizeUuid(req.query.ownerId, "ownerId");
    const q = normalizeOptionalText(req.query.q, {
      field: "q",
      minLength: 1,
      maxLength: 120,
      pattern: /^[A-Za-z0-9À-ÿ@._'()\-\/& ]+$/,
    });

    const where = {};

    if (status) where.status = status;
    if (date) where.date = date;
    if (ownerId) where.ownerId = ownerId;
    if (parkId || area) {
      where.location = {};
      if (parkId) where.location.parkId = parkId;
      if (area) where.location.area = area;
    }
    if (q) {
      where.OR = [
        { role: { contains: q, mode: "insensitive" } },
        { owner: { firstName: { contains: q, mode: "insensitive" } } },
        { owner: { lastName: { contains: q, mode: "insensitive" } } },
        { owner: { pernerNumber: { contains: q, mode: "insensitive" } } },
        { location: { name: { contains: q, mode: "insensitive" } } },
      ];
    }

    const requests = await prisma.shiftRequest.findMany({
      where,
      take: limit,
      orderBy: [{ createdAt: "desc" }],
      select: getAdminRequestSelect(),
    });

    return res.json(requests);
  } catch (err) {
    return respondWithRouteError(res, "ADMIN REQUESTS ERROR:", err);
  }
});

app.patch(
  "/admin/requests/:id",
  requireAuth,
  requireAdmin,
  requireJsonBody,
  async (req, res) => {
    try {
      const id = parseRequestId(req.params);
      const { status } = parseAdminRequestUpdatePayload(req.body);

      const existing = await prisma.shiftRequest.findUnique({
        where: { id },
      });

      if (!existing) {
        return res.status(404).json({ error: "Request not found" });
      }

      if (status === "OPEN" && existing.startsAt <= new Date()) {
        return res.status(400).json({ error: "Cannot reopen a request that has already started" });
      }

      const nextData =
        status === "OPEN"
          ? {
              status: "OPEN",
              acceptedByUserId: null,
              pendingAt: null,
              acceptedAt: null,
            }
          : {
              status: "CANCELED",
              acceptedByUserId: null,
              pendingAt: null,
              acceptedAt: null,
            };

      const request = await prisma.$transaction(async (tx) => {
        const updated = await tx.shiftRequest.update({
          where: { id },
          data: nextData,
          select: getAdminRequestSelect(),
        });

        await writeAuditLog(tx, {
          actorUserId: req.user.id,
          action: status === "OPEN" ? "REOPEN" : "CANCEL",
          entityType: "REQUEST",
          entityId: id,
          details: {
            previousStatus: existing.status,
            nextStatus: status,
          },
        });

        return updated;
      });

      return res.json(request);
    } catch (err) {
      return respondWithRouteError(res, "ADMIN UPDATE REQUEST ERROR:", err);
    }
  }
);

app.get("/admin/audit-logs", requireAuth, requireAdmin, async (req, res) => {
  try {
    const limit = parseAdminListLimit(req.query, 50, 200);

    const logs = await prisma.auditLog.findMany({
      take: limit,
      orderBy: [{ createdAt: "desc" }],
      select: getAdminAuditLogSelect(),
    });

    return res.json(logs);
  } catch (err) {
    return respondWithRouteError(res, "ADMIN AUDIT LOGS ERROR:", err);
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

app.use(errorMiddleware);

app.listen(port, () => console.log(`API running on http://localhost:${port}`));
