import { desc, eq, sql } from "drizzle-orm";
import { Send, Mail, Paperclip, ShieldAlert } from "lucide-react";
import { db } from "@/db";
import {
  partnerReports,
  reportBatches,
  partners,
  emailDeliveries,
  smtpSettings,
} from "@/db/schema";
import { requireUser, canSend } from "@/lib/auth";
import { ensureSeeded } from "@/lib/seed";
import { sendBatchAction, sendReportAction } from "../actions";
import { getTemplates, getSmtpConfig } from "@/lib/mailer";
import { renderTemplate, PLACEHOLDERS } from "@/lib/templates";
import {
  PageHead,
  Panel,
  Flash,
  StatusPill,
  LedgerTable,
  Silk,
  EmptyState,
  Mono,
  fmtDateTime,
  money,
} from "@/components/console-ui";

export const dynamic = "force-dynamic";

export default async function EmailCentrePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; msg?: string; batch?: string }>;
}) {
  await ensureSeeded();
  const user = await requireUser();
  const sp = await searchParams;

  const cfg = await getSmtpConfig();
  const templates = await getTemplates();
  const batches = await db.select().from(reportBatches).orderBy(desc(reportBatches.id)).limit(20);
  const batchId = Number(sp.batch || batches[0]?.id || 0);
  const batch = batches.find((b) => b.id === batchId);

  const reports = batchId
    ? await db.select().from(partnerReports).where(eq(partnerReports.batchId, batchId))
    : [];
  const partnerRows = await db.select().from(partners);
  const partnerById = new Map(partnerRows.map((p) => [p.id, p]));

  const deliveries = await db
    .select()
    .from(emailDeliveries)
    .orderBy(desc(emailDeliveries.id))
    .limit(40);
  const deliveryByReport = new Map(deliveries.map((d) => [d.reportId, d]));

  const [smtp] = await db.select().from(smtpSettings).limit(1);

  // Preview rendered against the first report of the selected batch.
  const previewReport = reports[0];
  const previewPartner = previewReport ? partnerById.get(previewReport.partnerId) : undefined;
  const previewSubject = renderTemplate(templates.subject, {
    partner_mail_address: previewPartner?.primaryEmail ?? "",
    start_date: batch?.startDate ?? "",
    end_date: batch?.endDate ?? "",
    SERVICE_NAME: previewReport?.serviceName ?? "",
  });
  const previewBody = renderTemplate(templates.body, {
    partner_mail_address: previewPartner?.primaryEmail ?? "",
    start_date: batch?.startDate ?? "",
    end_date: batch?.endDate ?? "",
    SERVICE_NAME: previewReport?.serviceName ?? "",
  });

  const eligible = reports.filter((r) => {
    const p = partnerById.get(r.partnerId);
    return p && p.active && p.primaryEmail && r.rowCount > 0;
  });

  return (
    <div className="space-y-9">
      <PageHead
        eyebrow="MODULE 08 · EMAIL CENTRE"
        title="Send partner reports"
        description="Individual, bulk and scheduled sending all follow the same rule: the workbook is generated and validated first, and an email is never transmitted without its correct service-specific attachment. Acceptance by the SMTP server is recorded separately from confirmed delivery."
        actions={
          <a href="/console/delivery" className="btn btn-ghost">
            Delivery history
          </a>
        }
      />

      <Flash status={sp.status} msg={sp.msg} />

      {!cfg.configured ? (
        <div className="flex items-start gap-3 border border-alert/50 bg-alert/10 px-5 py-4">
          <ShieldAlert size={17} className="mt-[2px] shrink-0 text-alert" strokeWidth={1.9} />
          <div>
            <div className="text-[12.5px] font-semibold text-alert">
              SMTP is not fully configured — sending is blocked
            </div>
            <p className="mt-1.5 text-[11.5px] leading-[1.8] text-alert/85">
              Missing: {cfg.missing.join(", ")}. Complete Email Settings and run the connection test
              before distributing any partner report.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 border border-teal/40 bg-teal/8 px-5 py-4">
          <Mail size={17} className="mt-[2px] shrink-0 text-teal-light" strokeWidth={1.9} />
          <div>
            <div className="text-[12.5px] font-semibold text-teal-light">
              SMTP ready — {smtp?.host}:{smtp?.port} ({smtp?.security})
            </div>
            <p className="mt-1.5 text-[11.5px] leading-[1.8] text-slate-warm">
              Sending as “{smtp?.fromName}” &lt;{smtp?.fromEmail}&gt;. The SMTP password is held
              encrypted server-side and is never returned to the browser, written to the audit log,
              or included in delivery records.
            </p>
          </div>
        </div>
      )}

      <Panel code="SELECT RUN" title="Choose the report batch to distribute">
        <div className="flex flex-wrap gap-2">
          {batches.map((b) => (
            <a
              key={b.id}
              href={`/console/email?batch=${b.id}`}
              className={`border px-4 py-3 transition-colors ${
                b.id === batchId ? "border-amber bg-amber/12" : "border-rule bg-charcoal-900 hover:border-amber/50"
              }`}
            >
              <Silk className={b.id === batchId ? "text-amber" : "text-slate-warm-dark"}>
                RUN #{String(b.id).padStart(4, "0")}
              </Silk>
              <div className="num mt-2 text-[11px] text-cream">
                {b.startDate} → {b.endDate}
              </div>
            </a>
          ))}
        </div>

        {batchId && reports.length ? (
          <div className="mt-6 flex flex-wrap items-center gap-4 border-t border-rule pt-6">
            <form action={sendBatchAction}>
              <input type="hidden" name="batchId" value={batchId} />
              <button type="submit" className="btn btn-amber py-3.5" disabled={!canSend(user)}>
                <Send size={13} strokeWidth={2.2} />
                Send all {eligible.length} eligible report{eligible.length === 1 ? "" : "s"}
              </button>
            </form>
            <p className="max-w-[52ch] text-[11px] leading-[1.8] text-slate-warm">
              Bulk sending transmits a separate email with its own attachment for every
              partner-service combination. Reports already accepted for this run are skipped so a
              retry can never duplicate a send.
            </p>
          </div>
        ) : null}
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <Panel code="QUEUE" title="Workbooks ready to send" tone="paper">
          {reports.length === 0 ? (
            <div className="p-5">
              <EmptyState
                code="00"
                title="Nothing queued for this run"
                body="Generate workbooks under Date Range & Processing first. Empty reports are never created and never sent."
              />
            </div>
          ) : (
            <LedgerTable
              head={["Partner", "Service", "Recipient", "Attachment", "Rows", "Revenue", "Status", "Action"]}
              minWidth={1180}
            >
              {reports.map((r) => {
                const partner = partnerById.get(r.partnerId);
                const existing = deliveryByReport.get(r.id);
                const blocked = !partner?.primaryEmail || r.rowCount === 0;
                return (
                  <tr key={r.id}>
                    <td>
                      <div className="text-[12px] font-semibold">{partner?.name ?? "—"}</div>
                      <div className="mt-1">
                        <Mono className="text-[10px] text-slate-warm-dark">{r.partnerCode}</Mono>
                      </div>
                    </td>
                    <td>
                      <Mono className="text-[11px] font-semibold text-amber-dark">{r.serviceName}</Mono>
                    </td>
                    <td>
                      <Mono className="text-[10.5px]">{partner?.primaryEmail ?? "—"}</Mono>
                      {partner?.ccEmails ? (
                        <div className="mt-1 text-[9.5px] text-slate-warm-dark">
                          cc {partner.ccEmails}
                        </div>
                      ) : null}
                    </td>
                    <td>
                      <div className="flex items-start gap-1.5">
                        <Paperclip size={10} className="mt-[3px] shrink-0 text-slate-warm-dark" strokeWidth={2} />
                        <Mono className="max-w-[230px] truncate text-[9.5px]">{r.filename}</Mono>
                      </div>
                    </td>
                    <td className="num r">{r.rowCount.toLocaleString()}</td>
                    <td className="num r">{money(r.revenueTotal)}</td>
                    <td>
                      <StatusPill status={existing?.status ?? "Ready to Send"} />
                      {existing ? (
                        <div className="mt-1.5 text-[9.5px] text-slate-warm-dark">
                          attempt {existing.attempts} · {fmtDateTime(existing.sentAt ?? existing.createdAt)}
                        </div>
                      ) : null}
                    </td>
                    <td>
                      {blocked ? (
                        <Silk className="text-alert">
                          {!partner?.primaryEmail ? "NO RECIPIENT" : "EMPTY REPORT"}
                        </Silk>
                      ) : (
                        <form action={sendReportAction}>
                          <input type="hidden" name="reportId" value={r.id} />
                          <button type="submit" className="btn btn-amber" disabled={!canSend(user)}>
                            <Send size={11} strokeWidth={2} />
                            {existing ? "Send again" : "Send"}
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </LedgerTable>
          )}
        </Panel>

        <div className="space-y-6">
          <Panel code="PREVIEW" title="Completed email, as it will be sent">
            <div className="border border-rule bg-[#fffdf8] p-5 text-charcoal">
              <div className="border-b border-cream-rule pb-4">
                <Silk className="text-slate-warm-dark">SUBJECT</Silk>
                <div className="num mt-2 text-[11.5px] font-semibold leading-[1.6]">
                  {previewSubject.value}
                </div>
              </div>
              <div className="mt-4 space-y-2.5 whitespace-pre-wrap text-[11.5px] leading-[1.85] text-charcoal/85">
                {previewBody.value}
              </div>
              <div className="mt-5 flex items-start gap-3 border-t border-cream-rule pt-4">
                <Paperclip size={13} className="mt-[2px] shrink-0 text-charcoal/60" strokeWidth={1.8} />
                <div>
                  <Mono className="text-[9.5px] font-semibold">
                    {previewReport?.filename ?? "no workbook selected"}
                  </Mono>
                  <div className="mt-1 silk-sm text-slate-warm-dark">
                    1 WORKSHEET · “UNRECONCILED LOGS” · MANDATORY ATTACHMENT
                  </div>
                </div>
              </div>
            </div>
            <p className="mt-4 text-[10.5px] leading-[1.8] text-slate-warm-dark">
              Previewed against{" "}
              {previewPartner ? `${previewPartner.name} · ${previewReport?.serviceName}` : "the selected run"}.
              Actual values are resolved per report at send time.
            </p>
          </Panel>

          <Panel code="PLACEHOLDERS" title="Values resolved before sending">
            <ul className="space-y-px">
              {PLACEHOLDERS.map((p) => (
                <li key={p.token} className="border-b border-rule py-3 last:border-0">
                  <Mono className="text-[10.5px] text-amber">{p.token}</Mono>
                  <div className="mt-1.5 text-[11px] leading-[1.7] text-slate-warm">{p.label}</div>
                  <Mono className="mt-1 block text-[9.5px] text-slate-warm-dark">e.g. {p.example}</Mono>
                </li>
              ))}
            </ul>
            <div className="mt-4 border border-alert/40 bg-alert/8 px-3.5 py-3">
              <p className="text-[10.5px] leading-[1.8] text-alert">
                If any required value is missing the send is blocked and recorded as an actionable
                failure — the message is never delivered half-complete.
              </p>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}


