"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, desc, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  uploads,
  vasLogRows,
  partners,
  services,
  partnerReports,
  reportBatches,
  emailDeliveries,
  emailTemplates,
  smtpSettings,
  automationSettings,
  users,
} from "@/db/schema";
import { requireUser, canManage, canSend, writeAudit, ROLE_LABEL } from "@/lib/auth";
import {
  hashPassword,
  encryptSecret,
  sha256,
  sanitizeFilename,
} from "@/lib/security";
import {
  parseWorkbookBuffer,
  normaliseRow,
  buildMatchers,
  REQUIRED_HEADERS,
} from "@/lib/ingest";
import {
  generateBatch,
  ensureStorage,
  UPLOAD_DIR,
  validateAttachment,
} from "@/lib/report";
import {
  getSmtpConfig,
  testSmtpConnection,
  sendTestEmail,
  sendDelivery,
  createDeliveryRecord,
  getTemplates,
} from "@/lib/mailer";
import { renderTemplate, DEFAULT_SUBJECT, DEFAULT_BODY } from "@/lib/templates";
import path from "node:path";
import fs from "node:fs/promises";

function flash(status: "ok" | "error" | "warn", message: string, to: string) {
  redirect(`${to}?status=${status}&msg=${encodeURIComponent(message)}`);
}

function requireManage(to: string) {
  return (user: { role: string }) => {
    if (!canManage(user as never)) {
      flash("error", "Only an administrator can change this configuration.", to);
    }
  };
}

/* ================================================================== */
/* 1. Upload & validate                                                */
/* ================================================================== */

export async function uploadLogsAction(formData: FormData) {
  const user = await requireUser();
  const to = "/console/uploads";
  if (!canSend(user)) flash("error", "Your role cannot upload source logs.", to);

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    flash("error", "Choose an .xlsx, .xls or .csv file before uploading.", to);
  }
  const original = (file as File).name;
  const ext = original.split(".").pop()?.toLowerCase() ?? "";
  if (!["xlsx", "xls", "csv"].includes(ext)) {
    flash("error", `"${original}" is not a supported format. Use .xlsx, .xls or .csv.`, to);
  }
  if ((file as File).size > 25 * 1024 * 1024) {
    flash("error", "The file exceeds the 25 MB processing limit.", to);
  }

  await ensureStorage();
  const buf = Buffer.from(await (file as File).arrayBuffer());
  const hash = sha256(buf);
  const safeName = sanitizeFilename(original);

  const prior = await db.select().from(uploads).where(eq(uploads.sha256, hash)).limit(1);
  const duplicateOf = prior.length ? prior[0].id : null;

  const storedPath = path.join(UPLOAD_DIR, `${Date.now()}-${safeName}`);
  await fs.writeFile(storedPath, buf);

  const { rows, headerIssues } = parseWorkbookBuffer(buf, safeName);
  const errors = headerIssues.filter((h) => h.severity === "error");

  const [upload] = await db
    .insert(uploads)
    .values({
      filename: safeName,
      storedPath,
      sha256: hash,
      sizeBytes: buf.byteLength,
      uploaderId: user.id,
      uploaderName: user.name,
      status: errors.length ? "Rejected" : "Processing",
      headerIssues: headerIssues.map((h) => `${h.severity.toUpperCase()}: ${h.message}`),
      duplicateOfUploadId: duplicateOf,
      message: errors.length
        ? "Required source columns failed validation."
        : "Parsed and awaiting partner/service matching.",
    })
    .returning();

  if (errors.length) {
    await writeAudit({
      actorEmail: user.email,
      actorRole: user.role,
      action: "UPLOAD_REJECTED",
      entity: "uploads",
      entityId: upload.id,
      detail: `${safeName} rejected — ${errors[0].message}`,
    });
    flash(
      "error",
      `Upload rejected — ${errors.map((e) => e.message).join(" ")}`,
      to
    );
  }

  const matchers = await buildMatchers();
  const normalised = rows.map((r) => normaliseRow(r, matchers));

  for (let i = 0; i < normalised.length; i += 400) {
    const chunk = normalised.slice(i, i + 400);
    await db.insert(vasLogRows).values(
      chunk.map((n) => ({
        uploadId: upload.id,
        sourceRow: n.sourceRow,
        logDate: n.logDate,
        servicePartner: n.servicePartner,
        serviceId: n.serviceId,
        pricePoint: n.pricePoint,
        productId: n.productId,
        productName: n.productName,
        transaction: n.transaction,
        countValue: n.countValue,
        revenueValue: n.revenueValue,
        rawDate: n.rawDate,
        partnerId: n.partnerId,
        serviceIdRef: n.serviceIdRef,
        matchStatus: n.matchStatus,
        issues: n.issues,
      }))
    );
  }

  const matched = normalised.filter((n) => n.matchStatus === "matched").length;
  const invalid = normalised.filter((n) => n.matchStatus === "invalid").length;
  const unmatched = normalised.length - matched - invalid;

  await db
    .update(uploads)
    .set({
      status: "Ready for Review",
      totalRows: normalised.length,
      validRows: matched,
      invalidRows: invalid + unmatched,
      message: `${matched} matched · ${unmatched} unmatched · ${invalid} invalid across ${normalised.length} source rows.`,
    })
    .where(eq(uploads.id, upload.id));

  await writeAudit({
    actorEmail: user.email,
    actorRole: user.role,
    action: "UPLOAD_PROCESSED",
    entity: "uploads",
    entityId: upload.id,
    detail: `${safeName} — ${normalised.length} rows, ${matched} matched${duplicateOf ? `; duplicate content of upload #${duplicateOf}` : ""}.`,
  });

  revalidatePath("/console");
  revalidatePath("/console/uploads");
  flash(
    duplicateOf ? "warn" : "ok",
    `${safeName} processed: ${matched} matched, ${unmatched} unmatched, ${invalid} invalid.${duplicateOf ? ` Warning — identical content to upload #${duplicateOf}.` : ""}`,
    to
  );
}

export async function deleteUploadAction(formData: FormData) {
  const user = await requireUser();
  requireManage("/console/uploads")(user);
  const id = Number(formData.get("id"));
  if (!id) flash("error", "Upload not found.", "/console/uploads");
  await db.delete(vasLogRows).where(eq(vasLogRows.uploadId, id));
  await db.delete(uploads).where(eq(uploads.id, id));
  await writeAudit({
    actorEmail: user.email,
    actorRole: user.role,
    action: "UPLOAD_DELETED",
    entity: "uploads",
    entityId: id,
  });
  revalidatePath("/console/uploads");
  flash("ok", "Upload and its source rows were removed.", "/console/uploads");
}

/* ================================================================== */
/* 2. Processing — inclusive date range                                */
/* ================================================================== */

export async function generateBatchAction(formData: FormData) {
  const user = await requireUser();
  const to = "/console/processing";
  if (!canSend(user)) flash("error", "Your role cannot run report processing.", to);

  const startDate = String(formData.get("startDate") ?? "");
  const endDate = String(formData.get("endDate") ?? "");
  const frequency = String(formData.get("frequency") ?? "daily");
  const autoSend = formData.get("autoSend") === "on";

  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    flash("error", "Select both an inclusive start date and end date.", to);
  }
  if (startDate > endDate) {
    flash("error", "The start date must fall on or before the end date.", to);
  }

  const result = await generateBatch({
    startDate,
    endDate,
    frequency,
    createdBy: user.id,
    createdByName: user.name,
    label: `Unreconciled logs ${startDate} → ${endDate}`,
  });

  await writeAudit({
    actorEmail: user.email,
    actorRole: user.role,
    action: "BATCH_GENERATED",
    entity: "report_batches",
    entityId: result.batchId,
    detail: `${result.reports.length} workbook(s) for ${startDate} → ${endDate}; ${result.stats.matchedRows} matched rows, ${result.stats.unmatchedRows} held for review.`,
  });

  if (autoSend && result.reports.length) {
    const cfg = await getSmtpConfig();
    if (!cfg.configured) {
      flash(
        "warn",
        `${result.reports.length} workbook(s) generated but not sent — SMTP settings are incomplete (${cfg.missing.join(", ")}).`,
        to
      );
    }
    const count = await queueAndSend(result.batchId, "scheduled", user);
    flash(
      "ok",
      `${result.reports.length} workbook(s) generated for ${startDate} → ${endDate}; ${count.sent} email(s) accepted, ${count.failed} failed.`,
      to
    );
  }

  revalidatePath("/console");
  revalidatePath("/console/reports");
  flash(
    result.stats.unmatchedRows > 0 ? "warn" : "ok",
    `${result.reports.length} workbook(s) generated for ${startDate} → ${endDate}. ${result.stats.matchedRows} matched rows; ${result.stats.unmatchedRows} rows held for review and excluded from partner reports.`,
    to
  );
}

/* ================================================================== */
/* 3. Partner register                                                 */
/* ================================================================== */

export async function savePartnerAction(formData: FormData) {
  const user = await requireUser();
  requireManage("/console/partners")(user);
  const to = "/console/partners";
  const id = Number(formData.get("id") || 0);
  const name = String(formData.get("name") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const primaryEmail = String(formData.get("primaryEmail") ?? "").trim();
  const ccEmails = String(formData.get("ccEmails") ?? "").trim();
  const frequency = String(formData.get("frequency") ?? "daily");
  const active = formData.get("active") === "on";
  const autoDelivery = formData.get("autoDelivery") === "on";
  const notes = String(formData.get("notes") ?? "").trim();

  if (!name || !code) flash("error", "Partner name and partner code are both required.", to);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(primaryEmail)) {
    flash("error", "Enter a valid primary recipient email address.", to);
  }

  if (id) {
    await db
      .update(partners)
      .set({ name, code, primaryEmail, ccEmails, frequency, active, autoDelivery, notes })
      .where(eq(partners.id, id));
    await writeAudit({
      actorEmail: user.email,
      actorRole: user.role,
      action: "PARTNER_UPDATED",
      entity: "partners",
      entityId: id,
      detail: `${name} (${code}) updated.`,
    });
  } else {
    const clash = await db.select().from(partners).where(eq(partners.code, code)).limit(1);
    if (clash.length) flash("error", `Partner code ${code} is already in use.`, to);
    const [row] = await db
      .insert(partners)
      .values({ name, code, primaryEmail, ccEmails, frequency, active, autoDelivery, notes })
      .returning();
    await writeAudit({
      actorEmail: user.email,
      actorRole: user.role,
      action: "PARTNER_CREATED",
      entity: "partners",
      entityId: row.id,
      detail: `${name} (${code}) added to the Partner Register.`,
    });
  }
  revalidatePath("/console/partners");
  flash("ok", `${name} saved to the Partner Register.`, to);
}

export async function togglePartnerAction(formData: FormData) {
  const user = await requireUser();
  requireManage("/console/partners")(user);
  const id = Number(formData.get("id"));
  const active = formData.get("active") === "true";
  await db.update(partners).set({ active: !active }).where(eq(partners.id, id));
  await writeAudit({
    actorEmail: user.email,
    actorRole: user.role,
    action: active ? "PARTNER_DEACTIVATED" : "PARTNER_ACTIVATED",
    entity: "partners",
    entityId: id,
  });
  revalidatePath("/console/partners");
  flash("ok", "Partner status updated.", "/console/partners");
}

/* ================================================================== */
/* 4. Service mapping register (manual, extensible)                    */
/* ================================================================== */

export async function saveServiceAction(formData: FormData) {
  const user = await requireUser();
  requireManage("/console/services")(user);
  const to = "/console/services";
  const id = Number(formData.get("id") || 0);
  const partnerId = Number(formData.get("partnerId") || 0);
  const serviceId = String(formData.get("serviceId") ?? "").trim().toUpperCase();
  const serviceName = String(formData.get("serviceName") ?? "").trim().toUpperCase();
  const active = formData.get("active") === "on";

  if (!partnerId) flash("error", "Select the partner this service belongs to.", to);
  if (!serviceId || !serviceName) {
    flash("error", "Both Service ID and Service Name are required for the mapping.", to);
  }

  const duplicate = await db
    .select()
    .from(services)
    .where(and(eq(services.serviceId, serviceId), id ? sql`${services.id} <> ${id}` : sql`true`))
    .limit(1);
  if (duplicate.length) {
    flash(
      "error",
      `Service ID ${serviceId} is already mapped to another partner. A service can only belong to one partner — remove or correct the existing mapping first.`,
      to
    );
  }

  if (id) {
    await db
      .update(services)
      .set({ partnerId, serviceId, serviceName, active, updatedAt: new Date() })
      .where(eq(services.id, id));
    await writeAudit({
      actorEmail: user.email,
      actorRole: user.role,
      action: "SERVICE_MAPPING_UPDATED",
      entity: "services",
      entityId: id,
      detail: `${serviceId} / ${serviceName} remapped.`,
    });
  } else {
    const [row] = await db
      .insert(services)
      .values({ partnerId, serviceId, serviceName, active })
      .returning();
    await writeAudit({
      actorEmail: user.email,
      actorRole: user.role,
      action: "SERVICE_MAPPING_CREATED",
      entity: "services",
      entityId: row.id,
      detail: `${serviceId} / ${serviceName} added to the service mapping register.`,
    });
  }
  revalidatePath("/console/services");
  revalidatePath("/console/unmatched");
  flash("ok", `${serviceId} · ${serviceName} saved to the service mapping register.`, to);
}

export async function toggleServiceAction(formData: FormData) {
  const user = await requireUser();
  requireManage("/console/services")(user);
  const id = Number(formData.get("id"));
  const active = formData.get("active") === "true";
  await db.update(services).set({ active: !active, updatedAt: new Date() }).where(eq(services.id, id));
  await writeAudit({
    actorEmail: user.email,
    actorRole: user.role,
    action: active ? "SERVICE_MAPPING_DISABLED" : "SERVICE_MAPPING_ENABLED",
    entity: "services",
    entityId: id,
  });
  revalidatePath("/console/services");
  flash("ok", "Service mapping updated.", "/console/services");
}

export async function deleteServiceAction(formData: FormData) {
  const user = await requireUser();
  requireManage("/console/services")(user);
  const id = Number(formData.get("id"));
  await db.delete(services).where(eq(services.id, id));
  await writeAudit({
    actorEmail: user.email,
    actorRole: user.role,
    action: "SERVICE_MAPPING_DELETED",
    entity: "services",
    entityId: id,
  });
  revalidatePath("/console/services");
  flash("ok", "Service mapping removed.", "/console/services");
}

/** Re-runs matching for stored rows after the mapping register changes. */
export async function rematchAllAction() {
  const user = await requireUser();
  requireManage("/console/services")(user);
  const matchers = await buildMatchers();
  const { matchRow } = await import("@/lib/ingest");
  const all = await db.select().from(vasLogRows);
  let changed = 0;
  for (const row of all) {
    const verdict = matchRow(
      {
        "SERVICE PARTNER": row.servicePartner,
        "SERVICE ID": row.serviceId,
        "PRODUCT NAME": row.productName,
      },
      matchers
    );
    const currentInvalid = row.matchStatus === "invalid";
    const nextStatus = currentInvalid ? "invalid" : verdict.matchStatus;
    if (nextStatus !== row.matchStatus || verdict.issues !== row.issues) {
      await db
        .update(vasLogRows)
        .set({
          partnerId: verdict.partnerId,
          serviceIdRef: verdict.serviceIdRef,
          matchStatus: nextStatus,
          issues: verdict.issues,
        })
        .where(eq(vasLogRows.id, row.id));
      changed++;
    }
  }
  await writeAudit({
    actorEmail: user.email,
    actorRole: user.role,
    action: "SERVICE_MAPPING_REMATCHED",
    entity: "vas_log_rows",
    detail: `${changed} of ${all.length} stored rows re-evaluated against the service mapping register.`,
  });
  revalidatePath("/console/services");
  revalidatePath("/console/unmatched");
  flash(
    "ok",
    `Matching re-run against the updated mapping register — ${changed} row(s) changed status.`,
    "/console/services"
  );
}

/* ================================================================== */
/* 5. Email centre                                                     */
/* ================================================================== */

async function queueAndSend(
  batchId: number,
  mode: "manual" | "bulk" | "scheduled" | "resend",
  user: { email: string; role: string }
): Promise<{ sent: number; failed: number; messages: string[] }> {
  const cfg = await getSmtpConfig();
  const templates = await getTemplates();

  const reports = await db
    .select()
    .from(partnerReports)
    .where(eq(partnerReports.batchId, batchId));

  const partnerIds = [...new Set(reports.map((r) => r.partnerId))];
  const partnerRows = partnerIds.length
    ? await db.select().from(partners).where(inArray(partners.id, partnerIds))
    : [];
  const partnerById = new Map(partnerRows.map((p) => [p.id, p]));

  let sent = 0;
  let failed = 0;
  const messages: string[] = [];

  for (const report of reports) {
    const partner = partnerById.get(report.partnerId);
    if (!partner || !partner.active) continue;

    const batch = await db.select().from(reportBatches).where(eq(reportBatches.id, batchId)).limit(1);
    const vars = {
      partner_mail_address: partner.primaryEmail,
      start_date: batch[0]?.startDate ?? "",
      end_date: batch[0]?.endDate ?? "",
      SERVICE_NAME: report.serviceName,
    };
    const subject = renderTemplate(templates.subject, vars);
    const body = renderTemplate(templates.body, vars);
    const unresolved = [...new Set([...subject.missing, ...body.missing])];
    if (unresolved.length) {
      failed++;
      messages.push(`${report.serviceName}: unresolved placeholder(s) ${unresolved.join(", ")}.`);
      continue;
    }

    const attachment = await validateAttachment(report.filePath);
    if (!attachment.ok) {
      failed++;
      messages.push(`${report.serviceName}: ${attachment.error ?? "attachment invalid"}.`);
      continue;
    }

    const { created, delivery } = await createDeliveryRecord({
      reportId: report.id,
      batchId,
      partnerId: partner.id,
      partnerName: partner.name,
      serviceName: report.serviceName,
      toEmail: partner.primaryEmail,
      ccEmails: partner.ccEmails,
      subject: templates.subject,
      bodySnapshot: templates.body,
      attachmentFilename: report.filename,
      attachmentPath: report.filePath,
      attachmentBytes: attachment.bytes,
      mode,
      idempotencySeed: `${mode}:${report.id}:${batchId}`,
    });

    if (!created && delivery.status === "Sent/Accepted") {
      messages.push(
        `${partner.name} · ${report.serviceName}: already accepted earlier — skipped to prevent a duplicate send.`
      );
      continue;
    }

    const outcome = await sendDelivery(delivery.id, { actorEmail: user.email });
    if (outcome.ok) sent++;
    else failed++;
    messages.push(`${partner.name} · ${report.serviceName}: ${outcome.message}`);
  }

  await writeAudit({
    actorEmail: user.email,
    actorRole: user.role,
    action: mode === "scheduled" ? "AUTOMATION_RUN" : "EMAIL_BULK_SEND",
    entity: "report_batches",
    entityId: batchId,
    detail: `${sent} accepted, ${failed} failed.`,
  });

  return { sent, failed, messages };
}

export async function sendBatchAction(formData: FormData) {
  const user = await requireUser();
  const to = "/console/email";
  if (!canSend(user)) flash("error", "Your role cannot send partner reports.", to);
  const batchId = Number(formData.get("batchId"));
  if (!batchId) flash("error", "Select a report batch to distribute.", to);
  const result = await queueAndSend(batchId, "bulk", user);
  revalidatePath("/console/email");
  revalidatePath("/console/delivery");
  flash(
    result.failed ? "warn" : "ok",
    `Bulk send complete — ${result.sent} accepted by the SMTP server, ${result.failed} failed.`,
    to
  );
}

export async function sendReportAction(formData: FormData) {
  const user = await requireUser();
  const to = "/console/email";
  if (!canSend(user)) flash("error", "Your role cannot send partner reports.", to);
  const reportId = Number(formData.get("reportId"));
  const [report] = await db.select().from(partnerReports).where(eq(partnerReports.id, reportId)).limit(1);
  if (!report) flash("error", "Report not found.", to);
  const [partner] = await db.select().from(partners).where(eq(partners.id, report.partnerId)).limit(1);
  const [batch] = await db.select().from(reportBatches).where(eq(reportBatches.id, report.batchId)).limit(1);
  const templates = await getTemplates();

  const attachment = await validateAttachment(report.filePath);
  if (!attachment.ok) {
    flash("error", `Email not sent — ${attachment.error ?? "the required workbook is missing."}`, to);
  }
  if (!partner?.primaryEmail) {
    flash("error", "Email not sent — the partner has no registered primary recipient.", to);
  }

  const { delivery, created } = await createDeliveryRecord({
    reportId: report.id,
    batchId: report.batchId,
    partnerId: partner.id,
    partnerName: partner.name,
    serviceName: report.serviceName,
    toEmail: partner.primaryEmail,
    ccEmails: partner.ccEmails,
    subject: templates.subject,
    bodySnapshot: templates.body,
    attachmentFilename: report.filename,
    attachmentPath: report.filePath,
    attachmentBytes: attachment.bytes,
    mode: "manual",
    idempotencySeed: `manual:${report.id}:${report.batchId}`,
  });

  const outcome = await sendDelivery(delivery.id, { actorEmail: user.email, force: !created });
  await writeAudit({
    actorEmail: user.email,
    actorRole: user.role,
    action: outcome.ok ? "EMAIL_SENT" : "EMAIL_FAILED",
    entity: "email_deliveries",
    entityId: delivery.id,
    detail: `${partner.name} · ${report.serviceName} → ${partner.primaryEmail}. ${outcome.message}`,
  });
  revalidatePath("/console/email");
  revalidatePath("/console/delivery");
  flash(outcome.ok ? "ok" : "error", outcome.message, to);
}

export async function retryDeliveryAction(formData: FormData) {
  const user = await requireUser();
  const to = "/console/delivery";
  if (!canSend(user)) flash("error", "Your role cannot retry delivery.", to);
  const id = Number(formData.get("id"));
  const outcome = await sendDelivery(id, { actorEmail: user.email });
  await writeAudit({
    actorEmail: user.email,
    actorRole: user.role,
    action: outcome.ok ? "EMAIL_RETRY_OK" : "EMAIL_RETRY_FAILED",
    entity: "email_deliveries",
    entityId: id,
    detail: outcome.message,
  });
  revalidatePath("/console/delivery");
  flash(outcome.ok ? "ok" : "error", outcome.message, to);
}

/** Explicit resend — always recorded as a new action, never as a retry. */
export async function resendDeliveryAction(formData: FormData) {
  const user = await requireUser();
  const to = "/console/delivery";
  if (!canSend(user)) flash("error", "Your role cannot resend reports.", to);
  const id = Number(formData.get("id"));
  const [orig] = await db.select().from(emailDeliveries).where(eq(emailDeliveries.id, id)).limit(1);
  if (!orig) flash("error", "Delivery record not found.", to);

  const { delivery } = await createDeliveryRecord({
    reportId: orig.reportId ?? 0,
    batchId: orig.batchId ?? 0,
    partnerId: orig.partnerId ?? 0,
    partnerName: orig.partnerName,
    serviceName: orig.serviceName,
    toEmail: orig.toEmail,
    ccEmails: orig.ccEmails,
    subject: orig.subject,
    bodySnapshot: orig.bodySnapshot,
    attachmentFilename: orig.attachmentFilename,
    attachmentPath: orig.attachmentPath,
    attachmentBytes: orig.attachmentBytes,
    mode: "resend",
    idempotencySeed: `resend:${id}:${Date.now()}`,
  });

  const outcome = await sendDelivery(delivery.id, { actorEmail: user.email, force: true });
  await writeAudit({
    actorEmail: user.email,
    actorRole: user.role,
    action: "EMAIL_RESEND",
    entity: "email_deliveries",
    entityId: delivery.id,
    detail: `Authorised resend of delivery #${id}. ${outcome.message}`,
  });
  revalidatePath("/console/delivery");
  flash(outcome.ok ? "ok" : "error", `Resend recorded as delivery #${delivery.id}. ${outcome.message}`, to);
}

/* ================================================================== */
/* 6. Email templates                                                  */
/* ================================================================== */

export async function saveTemplateAction(formData: FormData) {
  const user = await requireUser();
  requireManage("/console/settings/templates")(user);
  const to = "/console/settings/templates";
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!subject) flash("error", "The subject template cannot be empty.", to);
  if (!body) flash("error", "The body template cannot be empty.", to);

  await db
    .update(emailTemplates)
    .set({
      subject,
      body,
      isDefault: subject === DEFAULT_SUBJECT && body === DEFAULT_BODY,
      updatedBy: user.email,
      updatedAt: new Date(),
    })
    .where(eq(emailTemplates.key, "unreconciled_logs"));

  await writeAudit({
    actorEmail: user.email,
    actorRole: user.role,
    action: "TEMPLATE_UPDATED",
    entity: "email_templates",
    detail: "Subject and body templates updated. Historical delivery records retain their original snapshots.",
  });
  flash("ok", "Email templates saved. They apply to future sends only.", to);
}

export async function resetTemplateAction() {
  const user = await requireUser();
  requireManage("/console/settings/templates")(user);
  await db
    .update(emailTemplates)
    .set({
      subject: DEFAULT_SUBJECT,
      body: DEFAULT_BODY,
      isDefault: true,
      updatedBy: user.email,
      updatedAt: new Date(),
    })
    .where(eq(emailTemplates.key, "unreconciled_logs"));
  await writeAudit({
    actorEmail: user.email,
    actorRole: user.role,
    action: "TEMPLATE_RESET",
    entity: "email_templates",
  });
  flash("ok", "Default subject and body templates restored.", "/console/settings/templates");
}

/* ================================================================== */
/* 7. SMTP settings                                                    */
/* ================================================================== */

export async function saveSmtpAction(formData: FormData) {
  const user = await requireUser();
  requireManage("/console/settings/smtp")(user);
  const to = "/console/settings/smtp";
  const host = String(formData.get("host") ?? "").trim();
  const port = Number(formData.get("port") ?? 587);
  const login = String(formData.get("login") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fromName = String(formData.get("fromName") ?? "").trim();
  const fromEmail = String(formData.get("fromEmail") ?? "").trim();
  const security = String(formData.get("security") ?? "STARTTLS");
  const testEmail = String(formData.get("testEmail") ?? "").trim();

  if (!host || !port || !login) {
    flash("error", "SMTP Server, Port and Login are mandatory.", to);
  }

  const [existing] = await db.select().from(smtpSettings).limit(1);
  const updates: Partial<typeof smtpSettings.$inferInsert> = {
    host,
    port,
    login,
    fromName,
    fromEmail,
    security,
    testEmail,
    updatedBy: user.email,
    updatedAt: new Date(),
  };
  if (password.trim()) updates.passwordEnc = encryptSecret(password.trim());

  if (existing) {
    await db.update(smtpSettings).set(updates).where(eq(smtpSettings.id, existing.id));
  } else {
    await db.insert(smtpSettings).values({ ...updates, passwordEnc: updates.passwordEnc ?? "" });
  }

  const cfg = await getSmtpConfig();
  await writeAudit({
    actorEmail: user.email,
    actorRole: user.role,
    action: "SMTP_SETTINGS_UPDATED",
    entity: "smtp_settings",
    detail: `Server ${host}:${port} (${security}) saved. ${password.trim() ? "Password rotated." : "Password unchanged."} Credential values are not recorded.`,
  });
  flash(
    cfg.configured ? "ok" : "warn",
    cfg.configured
      ? "SMTP settings saved and encrypted at rest."
      : `SMTP settings saved but still incomplete — missing ${cfg.missing.join(", ")}. Automatic sending stays disabled until this is resolved.`,
    to
  );
}

export async function testSmtpAction() {
  const user = await requireUser();
  requireManage("/console/settings/smtp")(user);
  const result = await testSmtpConnection();
  await writeAudit({
    actorEmail: user.email,
    actorRole: user.role,
    action: "SMTP_CONNECTION_TEST",
    entity: "smtp_settings",
    detail: result.ok ? "Connection and authentication succeeded." : `Failed — ${result.message}`,
  });
  revalidatePath("/console/settings/smtp");
  flash(result.ok ? "ok" : "error", result.message, "/console/settings/smtp");
}

export async function sendTestEmailAction(formData: FormData) {
  const user = await requireUser();
  requireManage("/console/settings/smtp")(user);
  const to = String(formData.get("testEmail") ?? "").trim();
  const result = await sendTestEmail(to || undefined);
  await writeAudit({
    actorEmail: user.email,
    actorRole: user.role,
    action: "SMTP_TEST_EMAIL",
    entity: "smtp_settings",
    detail: result.ok ? `Test message sent to ${to || "configured address"}.` : `Failed — ${result.message}`,
  });
  flash(result.ok ? "ok" : "error", result.message, "/console/settings/smtp");
}

/* ================================================================== */
/* 8. Automation                                                       */
/* ================================================================== */

export async function saveAutomationAction(formData: FormData) {
  const user = await requireUser();
  requireManage("/console/settings/automation")(user);
  const to = "/console/settings/automation";
  const enabled = formData.get("enabled") === "on";
  const frequency = String(formData.get("frequency") ?? "daily");
  const timeOfDay = String(formData.get("timeOfDay") ?? "07:30");
  const timezone = String(formData.get("timezone") ?? "Africa/Lagos");
  const lookbackDays = Math.max(1, Number(formData.get("lookbackDays") ?? 1));

  const cfg = await getSmtpConfig();
  if (enabled && !cfg.configured) {
    flash(
      "error",
      `Automatic sending cannot be enabled until SMTP is configured and tested. Missing: ${cfg.missing.join(", ")}.`,
      to
    );
  }

  await db
    .update(automationSettings)
    .set({
      enabled,
      frequency,
      timeOfDay,
      timezone,
      lookbackDays,
      updatedBy: user.email,
      updatedAt: new Date(),
      nextRunAt: nextRun(timeOfDay, timezone),
    })
    .where(sql`${automationSettings.id} > 0`);

  await writeAudit({
    actorEmail: user.email,
    actorRole: user.role,
    action: "AUTOMATION_UPDATED",
    entity: "automation_settings",
    detail: `${enabled ? "Enabled" : "Disabled"} — ${frequency} at ${timeOfDay} ${timezone}, ${lookbackDays}-day lookback.`,
  });
  flash("ok", "Automation settings saved.", to);
}

function nextRun(timeOfDay: string, timezone: string): Date {
  const [h, m] = timeOfDay.split(":").map(Number);
  const now = new Date();
  const next = new Date(now);
  next.setHours(h || 0, m || 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  void timezone;
  return next;
}

export async function runAutomationNowAction() {
  const user = await requireUser();
  requireManage("/console/settings/automation")(user);
  const to = "/console/settings/automation";
  const [auto] = await db.select().from(automationSettings).limit(1);
  const cfg = await getSmtpConfig();
  if (!cfg.configured) {
    flash("error", `Cannot run — SMTP settings incomplete (${cfg.missing.join(", ")}).`, to);
  }

  const lookback = auto?.lookbackDays ?? 1;
  const end = new Date();
  const start = new Date(end.getTime() - Math.max(0, lookback - 1) * 86_400_000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const result = await generateBatch({
    startDate: fmt(start),
    endDate: fmt(end),
    frequency: auto?.frequency ?? "daily",
    createdBy: user.id,
    createdByName: user.name,
    label: `Scheduled run ${fmt(start)} → ${fmt(end)}`,
  });
  const outcome = await queueAndSend(result.batchId, "scheduled", user);

  await db.update(automationSettings).set({
    lastRunAt: new Date(),
    lastRunStatus: `${outcome.sent} accepted, ${outcome.failed} failed`,
    nextRunAt: nextRun(auto?.timeOfDay ?? "07:30", auto?.timezone ?? "Africa/Lagos"),
  });

  flash(
    outcome.failed ? "warn" : "ok",
    `Scheduled run complete — ${result.reports.length} workbook(s), ${outcome.sent} email(s) accepted, ${outcome.failed} failed.`,
    to
  );
}


