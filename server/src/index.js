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

// REGISTER
app.post("/auth/register", async (req, res) => {
  try {
    const { email, password, firstName, lastName, pernerNumber } = req.body ?? {};
    if (!email || !password || !firstName || !lastName || pernerNumber === undefined) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { pernerNumber: Number(pernerNumber) }] },
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
        pernerNumber: Number(pernerNumber),
      },
      select: { id: true, email: true, firstName: true, lastName: true, pernerNumber: true, createdAt: true },
    });

    const token = signToken(user);
    return res.status(201).json({ user, token });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
  
});

// LOGIN
app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Missing fields" });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    const token = signToken(user);

    return res.json({
      user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, pernerNumber: user.pernerNumber },
      token,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

app.get("/health", (_req, res) => res.json({ ok: true }));

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`API running on http://localhost:${port}`));
