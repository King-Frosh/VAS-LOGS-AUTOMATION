"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, destroySession, writeAudit } from "@/lib/auth";
import { verifyPassword } from "@/lib/security";
import { ensureSeeded } from "@/lib/seed";

export type LoginState = { error?: string };

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  await ensureSeeded();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) return { error: "Enter both your email address and password." };

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user || !user.active || !verifyPassword(password, user.passwordHash)) {
    await writeAudit({
      actorEmail: email,
      action: "AUTH_FAILED",
      entity: "users",
      detail: "Sign-in attempt rejected.",
    });
    return { error: "Those credentials were not recognised. Check them and try again." };
  }

  await createSession(user);
  await writeAudit({
    actorEmail: user.email,
    actorRole: user.role,
    action: "AUTH_SIGN_IN",
    entity: "users",
    entityId: user.id,
    detail: `${user.name} signed in.`,
  });
  redirect("/console");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
