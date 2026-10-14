import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import {
  ArrowRight,
  UploadCloud,
  CalendarRange,
  Send,
  AlertTriangle,
} from "lucide-react";
import { db } from "@/db";
import {
  uploads,
  vasLogRows,
  reportBatches,
  partnerReports,
  emailDeliveries,
  auditLogs,
  partners,
  services,
  automationSettings,
} from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { ensureSeeded } from "@/lib/seed";
import ProcessingStrip from "@/components/ProcessingStrip";
import {
  PageHead,
  Panel,
  Metric,
  StatusPill,
  LedgerTable,
  Silk,
  EmptyState,
  fmtDateTime,
  money,
} from "@/components/console-ui";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await ensureSeeded();
  const user = await requireUser();

  const [uploadAgg] = await db
    .select({
      count: sql<number>`count(*)::int`,
      rows: sql<number>`coalesce(sum(${uploads.totalRows}),0)::int`,
    })
    .from(uploads);

  const [rowAgg] = await db
    .select({
      total: sql<number>`count(*)::int`,
      matched: sql<number>`count(*) filter (where ${vasLogRows.matchStatus} = 'matched')::int`,
      unmatched: sql<number>`count(*) filter (where ${vasLogRows.matchStatus} like 'unmatched%')::int`,
      invalid: sql<number>`count(*) filter (where ${vasLogRows.matchStatus} = 'invalid')::int`,
    })
    .from(vasLogRows);

  const [reportAgg] = await db
    .select({
      count: sql<number>`count(*)::int`,
      rows: sql<number>`coalesce(sum(${partnerReports.rowCount}),0)::int`,
      revenue: sql<string>`coalesce(sum(${partnerReports.revenueTotal}::numeric),0)`,
    })
    .from(partnerReports);

  const [deliveryAgg] = await db
    .select({
      total: sql<number>`count(*)::int`,
      sent: sql<number>`count(*) filter (where ${emailDeliveries.status} = 'Sent/Accepted')::int`,
      failed: sql<number>`count(*) filter (where ${emailDeliveries.status} in ('Failed','Blocked'))::int`,
      queued: sql<number>`count(*) filter (where ${emailDeliveries.status} = 'Queued')::int`,
    })
    .from(emailDeliveries);

  const [registerAgg] = await db
    .select({
      partners: sql<number>`count(*) filter (where ${partners.active})::int`,
    })
    .from(partners);
  const [serviceAgg] = await db
    .select({ services: sql<number>`count(*) filter (where ${services.active})::int` })
    .from(services);

  const recentUploads = await db
    .select()
    .from(uploads)
    .orderBy(desc(uploads.createdAt))
    .limit(5);

  const recentBatches = await db
    .select()
    .from(reportBatches)
    .orderBy(desc(reportBatches.createdAt))
    .limit(5);

  const recentDeliveries = await db
    .select()
    .from(emailDeliveries)
    .orderBy(desc(emailDeliveries.createdAt))
    .limit(6);

  const recentAudit = await db.select().from(auditLogs).orderBy(desc(auditLogs.id)).limit(8);
  const [automation] = await db.select().from(automationSettings).limit(1);

  const stages = [
    { code: "01 / UPLOADED", label: "Source log files held in private storage", value: uploadAgg.count ?? 0, unit: "files", tone: "slate" as const },
    { code: "02 / SOURCE ROWS", label: "Original records retained with source row numbers", value: rowAgg.total ?? 0, unit: "rows", tone: "slate" as const },
    { code: "03 / MATCHED", label: "Resolved against Partner Register + service mapping", value: rowAgg.matched ?? 0, unit: "rows", tone: "teal" as const },
    { code: "04 / GENERATED", label: "Partner-service workbooks, one worksheet each", value: reportAgg.count ?? 0, unit: "books", tone: "amber" as const },
    { code: "05 / ACCEPTED", label: "Accepted by the SMTP server with attachment", value: deliveryAgg.sent ?? 0, unit: "emails", tone: "teal" as const },
    {
      code: "06 / ATTENTION",
      label: "Unmatched rows, failures and pending sends",
      value: (rowAgg.unmatched ?? 0) + (deliveryAgg.failed ?? 0) + (deliveryAgg.queued ?? 0),
      unit: "items",
      tone: "alert" as const,
    },
  ];

  return (
    <div className="space-y-9">
      <PageHead
        eyebrow="CONSOLE OVERVIEW · AFRICA/LAGOS"
        title={`Good to see you, ${user.name.split(" ")[0]}.`}
        description="Every upload, workbook and send attempt in one place. All reports issued from this console are labelled UNRECONCILED LOGS and must not be read as final reconciled revenue."
        actions={
          <>
            <Link href="/console/uploads" className="btn btn-amber">
              <UploadCloud size={13} strokeWidth={2.2} />
              Upload logs
            </Link>
            <Link href="/console/processing" className="btn btn-ghost">
              <CalendarRange size={13} strokeWidth={2.2} />
              Run processing
            </Link>
          </>
        }
      />

      {/* ---- the self-test ribbon ---- */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4">
          <Silk className="text-amber-dark">PROCESSING STRIP · SELF-TEST</Silk>
          <Silk className="text-slate-warm-dark">
            {automation?.enabled
              ? `AUTOMATION ENABLED · ${automation.frequency.toUpperCase()} AT ${automation.timeOfDay}`
              : "AUTOMATION DISABLED · SENDING IS MANUAL"}
          </Silk>
        </div>
        <div className="overflow-x-auto scroll-thin">
          <div className="min-w-[900px]">
            <ProcessingStrip stages={stages} />
          </div>
        </div>
      </div>

      {/* ---- metrics ---- */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          code="REGISTER"
          value={registerAgg.partners ?? 0}
          label="Active partners with registered recipients"
          tone="amber"
          sub={`${serviceAgg.services ?? 0} services mapped`}
        />
        <Metric
          code="WORKBOOKS"
          value={reportAgg.count ?? 0}
          label="Partner-service workbooks generated"
          tone="amber"
          sub={`${(reportAgg.rows ?? 0).toLocaleString()} source rows included`}
        />
        <Metric
          code="UNRECONCILED"
          value={money(reportAgg.revenue)}
          label="Revenue value carried in generated reports"
          tone="teal"
          sub="NGN · unreconciled, not final"
        />
        <Metric
          code="DELIVERY"
          value={`${deliveryAgg.sent ?? 0}/${deliveryAgg.total ?? 0}`}
          label="Emails accepted by the SMTP server"
          tone={(deliveryAgg.failed ?? 0) > 0 ? "alert" : "teal"}
          sub={`${deliveryAgg.failed ?? 0} failed or blocked · ${deliveryAgg.queued ?? 0} queued`}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        {/* ---- batches ---- */}
        <Panel
          code="RECENT PROCESSING RUNS"
          title="Report batches and reconciliation"
          tone="paper"
          right={
            <Link href="/console/reports" className="btn btn-dark">
              All reports
              <ArrowRight size={12} strokeWidth={2.2} />
            </Link>
          }
        >
          {recentBatches.length === 0 ? (
            <div className="p-5">
              <EmptyState
                code="00"
                title="No processing runs yet"
                body="Choose an inclusive start and end date under Date Range & Processing to generate the first set of partner-service workbooks."
                action={
                  <Link href="/console/processing" className="btn btn-amber">
                    Start a run
                  </Link>
                }
              />
            </div>
          ) : (
            <LedgerTable
              head={["Run", "Period", "Rows", "Matched", "Held", "Revenue", "Status"]}
              minWidth={820}
            >
              {recentBatches.map((b) => (
                <tr key={b.id}>
                  <td>
                    <div className="num text-[11.5px] font-semibold">#{String(b.id).padStart(4, "0")}</div>
                    <div className="mt-1 text-[11px] text-slate-warm-dark">{fmtDateTime(b.createdAt)}</div>
                  </td>
                  <td className="num text-[11.5px]">
                    {b.startDate} → {b.endDate}
                  </td>
                  <td className="num r">{b.sourceRows.toLocaleString()}</td>
                  <td className="num r">{b.matchedRows.toLocaleString()}</td>
                  <td className="num r">
                    <span className={b.unmatchedRows ? "text-amber-dark" : ""}>
                      {b.unmatchedRows.toLocaleString()}
                    </span>
                  </td>
                  <td className="num r">{money(b.matchedRevenue)}</td>
                  <td>
                    <StatusPill status={b.status} />
                  </td>
                </tr>
              ))}
            </LedgerTable>
          )}
        </Panel>

        {/* ---- audit ---- */}
        <Panel code="RECENT ACTIVITY" title="Audit trail">
          {recentAudit.length === 0 ? (
            <EmptyState code="00" title="Nothing recorded yet" body="Administrative and system actions appear here as they happen." />
          ) : (
            <ul className="divide-y divide-rule">
              {recentAudit.map((a) => (
                <li key={a.id} className="py-3.5 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <Silk className="text-amber-dark">{a.action.replace(/_/g, " ")}</Silk>
                      <p className="mt-1.5 text-[11.5px] leading-[1.7] text-slate-warm">{a.detail || a.entity}</p>
                      <p className="mt-1.5 text-[10.5px] text-slate-warm-dark">
                        {a.actorEmail} · {a.actorRole}
                      </p>
                    </div>
                    <div className="num shrink-0 text-[10px] text-slate-warm-dark">
                      {fmtDateTime(a.createdAt)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* ---- uploads ---- */}
        <Panel
          code="SOURCE LOGS"
          title="Recent uploads"
          tone="paper"
          right={
            <Link href="/console/uploads" className="btn btn-dark">
              Manage
              <ArrowRight size={12} strokeWidth={2.2} />
            </Link>
          }
        >
          {recentUploads.length === 0 ? (
            <div className="p-5">
              <EmptyState code="00" title="No files uploaded" body="Upload an MTN unreconciled log in .xlsx, .xls or .csv to begin." />
            </div>
          ) : (
            <LedgerTable head={["File", "Rows", "Matched", "Issues", "Status"]} minWidth={720}>
              {recentUploads.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="num max-w-[240px] truncate text-[11.5px] font-semibold">{u.filename}</div>
                    <div className="mt-1 text-[10.5px] text-slate-warm-dark">
                      {u.uploaderName} · {fmtDateTime(u.createdAt)}
                    </div>
                  </td>
                  <td className="num r">{u.totalRows.toLocaleString()}</td>
                  <td className="num r">{u.validRows.toLocaleString()}</td>
                  <td className="num r">
                    {u.duplicateOfUploadId ? (
                      <span className="inline-flex items-center gap-1 text-amber-dark">
                        <AlertTriangle size={11} strokeWidth={2} />
                        duplicate
                      </span>
                    ) : (
                      (u.headerIssues?.length ?? 0)
                    )}
                  </td>
                  <td>
                    <StatusPill status={u.status} />
                  </td>
                </tr>
              ))}
            </LedgerTable>
          )}
        </Panel>

        {/* ---- deliveries ---- */}
        <Panel
          code="OUTBOUND"
          title="Recent deliveries"
          right={
            <Link href="/console/delivery" className="btn btn-ghost">
              Full history
              <ArrowRight size={12} strokeWidth={2.2} />
            </Link>
          }
        >
          {recentDeliveries.length === 0 ? (
            <EmptyState
              code="00"
              title="No email dispatched yet"
              body="Generated workbooks appear in the Email Centre ready to send with their mandatory attachment."
              action={
                <Link href="/console/email" className="btn btn-amber">
                  <Send size={12} strokeWidth={2.2} />
                  Open Email Centre
                </Link>
              }
            />
          ) : (
            <ul className="divide-y divide-rule">
              {recentDeliveries.map((d) => (
                <li key={d.id} className="flex items-start justify-between gap-4 py-3.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[12px] font-semibold text-cream">{d.partnerName}</span>
                      <Silk className="text-amber-dark">{d.serviceName}</Silk>
                    </div>
                    <div className="num mt-1.5 truncate text-[10.5px] text-slate-warm-dark">
                      {d.attachmentFilename}
                    </div>
                    <div className="mt-1 text-[10.5px] text-slate-warm-dark">
                      → {d.toEmail} · attempt {d.attempts}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <StatusPill status={d.status} />
                    <div className="num mt-2 text-[10px] text-slate-warm-dark">{fmtDateTime(d.sentAt ?? d.createdAt)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
