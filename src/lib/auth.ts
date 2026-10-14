import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, auditLogs, type User } from "@/db/schema";
import { signToken, verifyToken } from "./security";

export const SESSION_COOKIE = "briccs_session";

export type Role = "administrator" | "operations" | "reviewer";

export const ROLE_LABEL: Record<Role, string> = {
  administrator: "Administrator",
  operations: "Operations user",
  reviewer: "Read-only reviewer",
};

export async function currentUser(): Promise<User | null> {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  const payload = verifyToken(raw);
  if (!payload || typeof payload.uid !== "number") return null;
  const [user] = await db.select().from(users).where(eq(users.id, payload.uid)).limit(1);
  return user && user.active ? user : null;
}

export async function requireUser(): Promise<User> {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

export function canManage(user: User): boolean {
  return user.role === "administrator";
}

export function canSend(user: User): boolean {
  return user.role === "administrator" || user.role === "operations";
}

export async function createSession(user: User) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, signToken({ uid: user.id, role: user.role }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function writeAudit(entry: {
  actorEmail?: string;
  actorRole?: string;
  action: string;
  entity?: string;
  entityId?: string | number;
  detail?: string;
}) {
  try {
    await db.insert(auditLogs).values({
      actorEmail: entry.actorEmail ?? "system",
      actorRole: entry.actorRole ?? "system",
      action: entry.action,
      entity: entry.entity ?? "",
      entityId: entry.entityId === undefined ? "" : String(entry.entityId),
      detail: entry.detail ?? "",
    });
  } catch {
    /* audit must never break the primary operation */
  }
}
