const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]/g;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class ValidationError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "ValidationError";
    this.status = status;
  }
}

function clampInteger(value, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const numericValue = Number(value);

  if (!Number.isInteger(numericValue)) {
    return fallback;
  }

  if (numericValue < min) {
    return min;
  }

  if (numericValue > max) {
    return max;
  }

  return numericValue;
}

export function parseIntegerEnv(
  rawValue,
  fallback,
  options = { min: 1, max: Number.MAX_SAFE_INTEGER }
) {
  if (rawValue === undefined || rawValue === null || rawValue === "") {
    return fallback;
  }

  return clampInteger(rawValue, fallback, options);
}

export function parseDurationEnv(rawValue, fallbackMs) {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallbackMs;
  }

  return Math.floor(parsed);
}

export function parseBooleanEnv(rawValue, fallback = false) {
  if (rawValue === undefined || rawValue === null || rawValue === "") {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(String(rawValue).trim().toLowerCase());
}

export function parseCookieSameSiteEnv(rawValue, fallback = "Lax") {
  if (rawValue === undefined || rawValue === null || rawValue === "") {
    return fallback;
  }

  const normalized = String(rawValue).trim().toLowerCase();

  if (normalized === "lax") return "Lax";
  if (normalized === "strict") return "Strict";
  if (normalized === "none") return "None";

  throw new Error("AUTH_COOKIE_SAME_SITE must be one of: Lax, Strict, None");
}

export function assertRequiredEnv(names) {
  const missing = names.filter((name) => !process.env[name]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}

export function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function assertAllowedKeys(payload, allowedKeys) {
  if (!isPlainObject(payload)) {
    throw new ValidationError("Request body must be a JSON object");
  }

  const allowed = new Set(allowedKeys);
  const unexpectedKeys = Object.keys(payload).filter((key) => !allowed.has(key));

  if (unexpectedKeys.length > 0) {
    throw new ValidationError(`Unexpected fields: ${unexpectedKeys.join(", ")}`);
  }
}

export function normalizeText(
  value,
  {
    field,
    minLength = 1,
    maxLength = 120,
    pattern = null,
    transform = null,
    trim = true,
  }
) {
  if (typeof value !== "string") {
    throw new ValidationError(`${field} must be a string`);
  }

  const withoutControls = value.replace(CONTROL_CHARACTERS, "");
  const normalizedValue = trim ? withoutControls.trim() : withoutControls;

  if (normalizedValue.length < minLength || normalizedValue.length > maxLength) {
    throw new ValidationError(
      `${field} must be between ${minLength} and ${maxLength} characters`
    );
  }

  if (pattern && !pattern.test(normalizedValue)) {
    throw new ValidationError(`${field} is invalid`);
  }

  return transform ? transform(normalizedValue) : normalizedValue;
}

export function normalizeOptionalText(value, options) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  return normalizeText(value, options);
}

export function normalizeEmail(value) {
  const email = normalizeText(value, {
    field: "email",
    minLength: 5,
    maxLength: 254,
    transform: (nextValue) => nextValue.toLowerCase(),
  });

  if (!EMAIL_PATTERN.test(email)) {
    throw new ValidationError("Email is invalid");
  }

  return email;
}

export function normalizePassword(value) {
  if (typeof value !== "string") {
    throw new ValidationError("Password must be a string");
  }

  const withoutControls = value.replace(CONTROL_CHARACTERS, "");

  if (withoutControls.length < 8 || withoutControls.length > 72) {
    throw new ValidationError("Password must be between 8 and 72 characters");
  }

  return withoutControls;
}

export function normalizePernerNumber(value) {
  return normalizeText(value, {
    field: "pernerNumber",
    minLength: 8,
    maxLength: 8,
    pattern: /^\d{8}$/,
  });
}

export function normalizeName(value, field) {
  return normalizeText(value, {
    field,
    minLength: 1,
    maxLength: 80,
    pattern: /^[A-Za-zÀ-ÿ' -]+$/,
  });
}

export function normalizeRole(value) {
  return normalizeText(value, {
    field: "role",
    minLength: 2,
    maxLength: 80,
    pattern: /^[A-Za-z0-9À-ÿ'()\-/.&, ]+$/,
  });
}

export function normalizeDateString(value, field = "date") {
  const normalizedValue = normalizeText(value, {
    field,
    minLength: 10,
    maxLength: 10,
    pattern: /^\d{4}-\d{2}-\d{2}$/,
  });

  const parsed = new Date(`${normalizedValue}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new ValidationError(`${field} is invalid`);
  }

  return normalizedValue;
}

export function normalizeTimeString(value, field) {
  return normalizeText(value, {
    field,
    minLength: 5,
    maxLength: 5,
    pattern: /^(?:[01]\d|2[0-3]):[0-5]\d$/,
  });
}

export function normalizeUuid(value, field = "id") {
  return normalizeText(value, {
    field,
    minLength: 36,
    maxLength: 36,
    pattern: UUID_PATTERN,
  });
}

export function normalizeEnum(value, allowedValues, field) {
  const normalizedValue = normalizeText(value, {
    field,
    minLength: 1,
    maxLength: 40,
  });

  if (!allowedValues.includes(normalizedValue)) {
    throw new ValidationError(`${field} is invalid`);
  }

  return normalizedValue;
}

export function normalizeBoolean(value, field) {
  if (typeof value !== "boolean") {
    throw new ValidationError(`${field} must be a boolean`);
  }

  return value;
}

export function normalizeIdentifier(value, field, maxLength = 64) {
  return normalizeText(value, {
    field,
    minLength: 1,
    maxLength,
    pattern: /^[A-Za-z0-9_-]+$/,
  });
}

export function normalizeArea(value) {
  return normalizeText(value, {
    field: "area",
    minLength: 1,
    maxLength: 60,
    pattern: /^[A-Za-z0-9À-ÿ _-]+$/,
  });
}

export function normalizeLimit(value, fallback, max) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const normalizedValue = Number(value);

  if (!Number.isInteger(normalizedValue) || normalizedValue < 1 || normalizedValue > max) {
    throw new ValidationError(`limit must be an integer between 1 and ${max}`);
  }

  return normalizedValue;
}

export function securityHeaders(req, res, next) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  next();
}

export function requireJsonBody(req, res, next) {
  const contentType = req.headers["content-type"] || "";

  if (!contentType.toLowerCase().includes("application/json")) {
    return res.status(415).json({ error: "Content-Type must be application/json" });
  }

  if (!isPlainObject(req.body)) {
    return res.status(400).json({ error: "Request body must be a JSON object" });
  }

  next();
}

function cleanupExpiredEntries(store, now) {
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt <= now) {
      store.delete(key);
    }
  }
}

export function createRateLimiter({ name, windowMs, max, keyBuilder }) {
  const store = new Map();

  return (req, res, next) => {
    const now = Date.now();
    cleanupExpiredEntries(store, now);

    const key = `${name}:${keyBuilder(req)}`;
    const currentEntry = store.get(key);

    if (!currentEntry || currentEntry.resetAt <= now) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    currentEntry.count += 1;

    if (currentEntry.count > max) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((currentEntry.resetAt - now) / 1000)
      );
      res.setHeader("Retry-After", String(retryAfterSeconds));
      return res.status(429).json({
        error: "Too many requests",
        code: "RATE_LIMITED",
      });
    }

    return next();
  };
}

export function getClientIp(req) {
  return (
    req.ip ||
    req.headers["x-forwarded-for"] ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}

function serializeCookie(name, value, options = {}) {
  const segments = [`${name}=${encodeURIComponent(value)}`];

  if (options.maxAge !== undefined) {
    segments.push(`Max-Age=${Math.floor(options.maxAge)}`);
  }

  segments.push(`Path=${options.path || "/"}`);

  if (options.httpOnly) {
    segments.push("HttpOnly");
  }

  if (options.sameSite) {
    segments.push(`SameSite=${options.sameSite}`);
  }

  if (options.secure) {
    segments.push("Secure");
  }

  return segments.join("; ");
}

export function setAuthCookie(
  res,
  token,
  { cookieName, maxAgeSeconds, secure, sameSite = "Lax" }
) {
  res.setHeader(
    "Set-Cookie",
    serializeCookie(cookieName, token, {
      httpOnly: true,
      maxAge: maxAgeSeconds,
      path: "/",
      sameSite,
      secure,
    })
  );
}

export function clearAuthCookie(res, { cookieName, secure, sameSite = "Lax" }) {
  res.setHeader(
    "Set-Cookie",
    serializeCookie(cookieName, "", {
      httpOnly: true,
      maxAge: 0,
      path: "/",
      sameSite,
      secure,
    })
  );
}

export function parseCookies(cookieHeader = "") {
  return cookieHeader
    .split(";")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .reduce((accumulator, segment) => {
      const separatorIndex = segment.indexOf("=");

      if (separatorIndex === -1) {
        return accumulator;
      }

      const key = segment.slice(0, separatorIndex).trim();
      const value = segment.slice(separatorIndex + 1).trim();

      accumulator[key] = decodeURIComponent(value);
      return accumulator;
    }, {});
}

export function getAuthTokenFromRequest(req, cookieName) {
  const authHeader = req.headers.authorization || "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme === "Bearer" && token) {
    return token;
  }

  const cookies = parseCookies(req.headers.cookie || "");
  return cookies[cookieName] || null;
}

export function createCorsOptions(allowedOrigins) {
  return {
    credentials: true,
    origin(origin, callback) {
      if (!origin || allowedOrigins.size === 0 || allowedOrigins.has(origin)) {
        return callback(null, true);
      }

      return callback(new ValidationError("Origin not allowed", 403));
    },
  };
}

export function errorMiddleware(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  if (err?.type === "entity.too.large") {
    return res.status(413).json({ error: "Payload too large" });
  }

  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({ error: "Malformed JSON payload" });
  }

  if (err instanceof ValidationError) {
    return res.status(err.status || 400).json({ error: err.message });
  }

  console.error("UNHANDLED ERROR:", err);
  return res.status(500).json({ error: "Server error" });
}
