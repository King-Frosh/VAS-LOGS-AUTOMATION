import nodemailer from "nodemailer";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  smtpSettings,
  emailDeliveries,
  emailDeliveryAttempts,
  emailTemplates,
  partnerReports,
  partners,
  reportBatches,
} from "@/db/schema";
import { decryptSecret, encryptSecret } from "./security";
import { validateAttachment } from "./report";
import { renderTemplate, DEFAULT_SUBJECT, DEFAULT_BODY } from "./templates";

export type SmtpConfig = {
  host: string;
  port: number;
  login: string;
  password: string;
  fromName: string;
  fromEmail: string;
  security: "STARTTLS" | "TLS" | "None";
  testEmail: string;
  configured: boolean;
  missing: string[];
};

export async function getSmtpConfig(): Promise<SmtpConfig> {
  const [row] = await db.select().from(smtpSettings).limit(1);
  const cfg: SmtpConfig = {
    host: row?.host ?? "",
    port: row?.port ?? 587,
    login: row?.login ?? "",
    password: decryptSecret(row?.passwordEnc ?? ""),
    fromName: row?.fromName ?? "BRICCS International Ideal Limited",
    fromEmail: row?.fromEmail ?? "",
    security: (row?.security as SmtpConfig["security"]) ?? "STARTTLS",
    testEmail: row?.testEmail ?? "",
    configured: false,
    missing: [],
  };
  if (!cfg.host) cfg.missing.push("SMTP Server");
  if (!cfg.port) cfg.missing.push("Port");
  if (!cfg.login) cfg.missing.push("Login");
  if (!cfg.password) cfg.missing.push("Password");
  if (!cfg.fromEmail) cfg.missing.push("From Email");
  cfg.configured = cfg.missing.length === 0;
  return cfg;
}

/** Password never leaves the server — only a masked hint is ever shown to the UI. */
export function maskSecret(secret: string): string {
  if (!secret) return "";
  return "•".repeat(Math.min(16, Math.max(8, secret.length)));
}

function buildTransport(cfg: SmtpConfig) {
  const secure = cfg.security === "TLS" || cfg.port === 465;
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure,
    auth: cfg.login && cfg.password ? { user: cfg.login, pass: cfg.password } : undefined,
    requireTLS: cfg.security === "STARTTLS",
    tls: { rejectUnauthorized: true },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
  });
}

function sanitiseSmtpError(err: unknown): string {
  const e = err as { code?: string; message?: string; responseCode?: number; response?: string };
  const code = e.code ? `${e.code}` : "";
  const msg = String(e.message ?? err ?? "Unknown SMTP error");
  const lower = msg.toLowerCase();
  if (lower.includes("authentication") || code === "EAUTH") {
    return "Authentication rejected. Verify the SMTP Login and Password, then test again.";
  }
  if (code === "ECONNREFUSED" || code === "ETIMEDOUT" || code === "EHOSTUNREACH") {
    return `Could not reach ${"the SMTP server"} (${code}). Confirm the SMTP Server, Port and that outbound SMTP is permitted by the hosting environment.`;
  }
  if (code === "ESOCKET" && lower.includes("certificate")) {
    return "TLS certificate validation failed. Confirm the Security setting matches the provider (STARTTLS on 587, TLS on 465).";
  }
  return msg.replace(/password[^\s]*/gi, "•••").slice(0, 400);
}

export async function testSmtpConnection(): Promise<{ ok: boolean; message: string }> {
  const cfg = await getSmtpConfig();
  if (!cfg.configured) {
    return {
      ok: false,
      message: `Missing required setting(s): ${cfg.missing.join(", ")}. SMTP Server, Port, Login and Password are all mandatory.`,
    };
  }
  const transporter = buildTransport(cfg);
  try {
    await transporter.verify();
    return {
      ok: true,
      message: `Connected to ${cfg.host}:${cfg.port} and authenticated as ${cfg.login}.`,
    };
  } catch (err) {
    return { ok: false, message: sanitiseSmtpError(err) };
  } finally {
    transporter.close();
  }
}

export async function sendTestEmail(to?: string): Promise<{ ok: boolean; message: string }> {
  const cfg = await getSmtpConfig();
  const recipient = (to ?? cfg.testEmail).trim();
  if (!cfg.configured) {
    return {
      ok: false,
      message: `Missing required setting(s): ${cfg.missing.join(", ")}.`,
    };
  }
  if (!recipient) {
    return { ok: false, message: "Provide a test email address before sending a test message." };
  }
  const transporter = buildTransport(cfg);
  try {
    const info = await transporter.sendMail({
      from: `"${cfg.fromName}" <${cfg.fromEmail}>`,
      to: recipient,
      subject: "BRICCS VAS Revenue Console — SMTP delivery test",
      text: `This test message confirms that the BRICCS VAS Revenue Console can deliver mail through ${cfg.host}:${cfg.port}.\n\nAccepted at ${new Date().toISOString()}.`,
    });
    return {
      ok: true,
      message: `Test message accepted by ${cfg.host} for ${recipient} (ref ${info.messageId}). Acceptance by the SMTP server does not by itself confirm inbox delivery.`,
    };
  } catch (err) {
    return { ok: false, message: sanitiseSmtpError(err) };
  } finally {
    transporter.close();
  }
}

export async function getTemplates() {
  const [row] = await db.select().from(emailTemplates).limit(1);
  return {
    subject: row?.subject ?? DEFAULT_SUBJECT,
    body: row?.body ?? DEFAULT_BODY,
    isDefault: row?.isDefault ?? true,
    updatedAt: row?.updatedAt ?? null,
    updatedBy: row?.updatedBy ?? "",
  };
}

export type SendOutcome = {
  ok: boolean;
  status: string;
  message: string;
  deliveryId?: number;
};

/**
 * Sends one partner-service report. The workbook is generated first and is
 * mandatory: without a valid, readable, single-worksheet attachment the send
 * is blocked and the delivery is recorded as Failed.
 */
export async function sendDelivery(
  deliveryId: number,
  opts: { actorEmail?: string; force?: boolean } = {}
): Promise<SendOutcome> {
  const [delivery] = await db
    .select()
    .from(emailDeliveries)
    .where(eq(emailDeliveries.id, deliveryId))
    .limit(1);
  if (!delivery) return { ok: false, status: "Failed", message: "Delivery record not found." };

  if (delivery.status === "Sent/Accepted" && !opts.force) {
    return {
      ok: false,
      status: "Sent/Accepted",
      message:
        "This report has already been accepted by the SMTP server. Use an explicit Resend to send it again — retries never duplicate a send.",
      deliveryId,
    };
  }

  const attemptNo = delivery.attempts + 1;

  /* ---- 1. mandatory attachment validation ---- */
  const attachment = await validateAttachment(delivery.attachmentPath);
  if (!attachment.ok) {
    await recordAttempt(deliveryId, attemptNo, "Failed", attachment.error ?? "Invalid attachment.");
    await db
      .update(emailDeliveries)
      .set({
        status: "Failed",
        attempts: attemptNo,
        errorMessage: `Blocked before sending: ${attachment.error ?? "attachment invalid"}`,
      })
      .where(eq(emailDeliveries.id, deliveryId));
    return {
      ok: false,
      status: "Failed",
      message: `Email not sent — ${attachment.error ?? "the required workbook is missing or invalid."}`,
      deliveryId,
    };
  }

  /* ---- 2. recipient ---- */
  if (!delivery.toEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(delivery.toEmail)) {
    await recordAttempt(deliveryId, attemptNo, "Blocked", "Recipient address missing or malformed.");
    await db
      .update(emailDeliveries)
      .set({ status: "Blocked", attempts: attemptNo, errorMessage: "Recipient address missing or invalid." })
      .where(eq(emailDeliveries.id, deliveryId));
    return { ok: false, status: "Blocked", message: "Email not sent — no valid partner recipient address.", deliveryId };
  }

  /* ---- 3. SMTP ---- */
  const cfg = await getSmtpConfig();
  if (!cfg.configured) {
    await recordAttempt(deliveryId, attemptNo, "Blocked", `SMTP not configured: missing ${cfg.missing.join(", ")}.`);
    await db
      .update(emailDeliveries)
      .set({
        status: "Blocked",
        attempts: attemptNo,
        errorMessage: `SMTP settings incomplete: ${cfg.missing.join(", ")}.`,
      })
      .where(eq(emailDeliveries.id, deliveryId));
    return {
      ok: false,
      status: "Blocked",
      message: `Email not sent — SMTP settings incomplete (${cfg.missing.join(", ")}).`,
      deliveryId,
    };
  }

  /* ---- 4. resolve placeholders (blocks on anything unresolved) ---- */
  const [report] = await db.select().from(partnerReports).where(eq(partnerReports.id, delivery.reportId ?? -1)).limit(1);
  const [batch] = report
    ? await db.select().from(reportBatches).where(eq(reportBatches.id, report.batchId)).limit(1)
    : [undefined];

  const vars = {
    partner_mail_address: delivery.toEmail,
    start_date: batch?.startDate ?? "",
    end_date: batch?.endDate ?? "",
    SERVICE_NAME: delivery.serviceName,
  };
  const subject = renderTemplate(delivery.subject, vars);
  const body = renderTemplate(delivery.bodySnapshot, vars);
  const unresolved = [...new Set([...subject.missing, ...body.missing])];
  if (unresolved.length) {
    await recordAttempt(deliveryId, attemptNo, "Blocked", `Unresolved placeholder(s): ${unresolved.join(", ")}`);
    await db
      .update(emailDeliveries)
      .set({
        status: "Blocked",
        attempts: attemptNo,
        errorMessage: `Unresolved placeholder(s): ${unresolved.join(", ")}`,
      })
      .where(eq(emailDeliveries.id, deliveryId));
    return {
      ok: false,
      status: "Blocked",
      message: `Email not sent — unresolved placeholder(s): ${unresolved.join(", ")}`,
      deliveryId,
    };
  }

  const ccList = (delivery.ccEmails ?? "")
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);

  const transporter = buildTransport(cfg);
  try {
    const fsMod = await import("node:fs/promises");
    const fileBuf = await fsMod.readFile(delivery.attachmentPath);

    const info = await transporter.sendMail({
      from: `"${cfg.fromName}" <${cfg.fromEmail}>`,
      to: delivery.toEmail,
      cc: ccList.length ? ccList : undefined,
      subject: subject.value,
      text: body.value,
      attachments: [
        {
          filename: delivery.attachmentFilename,
          content: fileBuf,
          contentType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
      ],
      headers: { "X-BRICCS-Report": String(delivery.reportId ?? ""), "X-BRICCS-Idempotency": delivery.idempotencyKey },
    });

    await recordAttempt(
      deliveryId,
      attemptNo,
      "Sent/Accepted",
      "",
      `SMTP accepted ${info.messageId ?? "message"}${info.response ? ` — ${info.response}` : ""}`
    );
    await db
      .update(emailDeliveries)
      .set({
        status: "Sent/Accepted",
        attempts: attemptNo,
        sentAt: new Date(),
        errorMessage: "",
        providerResponse: info.messageId ?? "",
        subject: subject.value,
        bodySnapshot: body.value,
      })
      .where(eq(emailDeliveries.id, deliveryId));

    return {
      ok: true,
      status: "Sent/Accepted",
      message: `Accepted by ${cfg.host} for ${delivery.toEmail} with attachment ${delivery.attachmentFilename} (${attachment.bytes.toLocaleString()} bytes). Acceptance by the SMTP server does not by itself confirm inbox delivery.`,
      deliveryId,
    };
  } catch (err) {
    const message = sanitiseSmtpError(err);
    await recordAttempt(deliveryId, attemptNo, "Failed", message);
    await db
      .update(emailDeliveries)
      .set({ status: "Failed", attempts: attemptNo, errorMessage: message })
      .where(eq(emailDeliveries.id, deliveryId));
    return { ok: false, status: "Failed", message: `Email not sent — ${message}`, deliveryId };
  } finally {
    transporter.close();
  }
}

async function recordAttempt(
  deliveryId: number,
  attemptNo: number,
  status: string,
  errorMessage = "",
  providerResponse = ""
) {
  await db.insert(emailDeliveryAttempts).values({
    deliveryId,
    attemptNo,
    status,
    errorMessage,
    providerResponse,
  });
}

/** Creates a delivery record with a stable idempotency key. */
export async function createDeliveryRecord(params: {
  reportId: number;
  batchId: number;
  partnerId: number;
  partnerName: string;
  serviceName: string;
  toEmail: string;
  ccEmails: string;
  subject: string;
  bodySnapshot: string;
  attachmentFilename: string;
  attachmentPath: string;
  attachmentBytes: number;
  mode: "manual" | "bulk" | "scheduled" | "resend";
  idempotencySeed: string;
}) {
  const existing = await db
    .select()
    .from(emailDeliveries)
    .where(eq(emailDeliveries.idempotencyKey, params.idempotencySeed))
    .limit(1);
  if (existing.length) return { created: false as const, delivery: existing[0] };

  const [row] = await db
    .insert(emailDeliveries)
    .values({ ...params, idempotencyKey: params.idempotencySeed, status: "Queued" })
    .returning();
  return { created: true as const, delivery: row };
}

export { partners };
