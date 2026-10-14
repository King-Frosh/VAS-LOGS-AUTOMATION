import crypto from "node:crypto";

/** Application secret. Falls back to a stable derivation so the sandbox always boots. */
function appSecret(): string {
  const explicit = process.env.APP_SECRET;
  if (explicit && explicit.length >= 16) return explicit;
  return crypto
    .createHash("sha256")
    .update(process.env.DATABASE_URL ?? "briccs-vas-revenue-console")
    .digest("hex");
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, salt, hash] = parts;
  const candidate = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(hash));
}

export function signToken(payload: Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", appSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyToken(token: string): Record<string, unknown> | null {
  const dot = token.lastIndexOf(".");
  if (dot < 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = crypto.createHmac("sha256", appSecret()).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

/* ---------------- secret storage (SMTP password never leaves the server) --------------- */

export function encryptSecret(plain: string): string {
  if (!plain) return "";
  const key = crypto.createHash("sha256").update(appSecret()).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join(".");
}

export function decryptSecret(payload: string): string {
  if (!payload) return "";
  const parts = payload.split(".");
  if (parts.length !== 3) return "";
  try {
    const key = crypto.createHash("sha256").update(appSecret()).digest();
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(parts[0], "base64"));
    decipher.setAuthTag(Buffer.from(parts[1], "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(parts[2], "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return "";
  }
}

/* ---------------- file name / spreadsheet hardening ---------------- */

export function sanitizeFilename(input: string): string {
  return input
    .replace(/[\u0000-\u001f<>:"/\\|?*]/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[._-]+|[._-]+$/g, "")
    .slice(0, 180);
}

export function slugSegment(input: string): string {
  return (
    input
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "_")
      .toUpperCase()
      .slice(0, 48) || "UNSPECIFIED"
  );
}

/**
 * Spreadsheet formula injection guard — any cell starting with = + - @ or a
 * control character is prefixed with a single quote before it is written.
 */
export function safeCellValue(value: string | number | null | undefined): string | number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const trimmed = value.trim();
  if (trimmed === "") return "";
  if (/^[=+\-@\t\r]/.test(trimmed)) return `'${trimmed}`;
  return trimmed;
}

export function sha256(buf: Buffer): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
}
