import { desc, eq } from "drizzle-orm";
import { FileSpreadsheet, Send, Eye } from "lucide-react";
import { db } from "@/db";
import { partnerReports, reportBatches, partners } from "@/db/schema";
import { requireUser, canSend } from "@/lib/auth";
import { ensureSeeded } from "@/lib/seed";
import { sendReportAction } from "../actions";
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

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; msg?: string; batch?: string }>;
}) {
  await ensureSeeded();
  const user = await requireUser();
  const sp = await searchParams;

  const batches = await db.select().from(reportBatches).orderBy(desc(reportBatches.id)).limit(30);
  const batchId = Number(sp.batch || batches[0]?.id || 0);

  const reports = batchId
    ? await db.select().from(partnerReports).where(eq(partnerReports.batchId, batchId))
    : [];
  const partnerRows = await db.select().from(partners);
  const partnerById = new Map(partnerRows.map((p) => [p.id, p]));
  const batch = batches.find((b) => b.id === batchId);

  return (
    <div className="space-y-9">
      <PageHead
        eyebrow="MODULE 07 · GENERATED REPORTS"
        title="Partner-service workbooks"
        description="Each workbook contains exactly one worksheet named “Unreconciled Logs”, the nine original MTN headers in their original order, and only the records for one partner, one service and the selected inclusive reporting period. Repeated source rows are preserved as they appear in the log."
      />

      <Flash status={sp.status} msg={sp.msg} />

      <Panel code="SELECT RUN" title="Processing runs">
        {batches.length === 0 ? (
          <EmptyState
            code="00"
            title="No reports generated yet"
            body="Run Date Range & Processing to produce the first set of partner-service workbooks."
          />
        ) : (
          <div className="flex flex-wrap gap-2">
            {batches.map((b) => (
              <a
                key={b.id}
                href={`/console/reports?batch=${b.id}`}
                className={`border px-4 py-3 transition-colors ${
                  b.id === batchId
                    ? "border-amber bg-amber/12"
                    : "border-rule bg-charcoal-900 hover:border-amber/50"
                }`}
              >
                <Silk className={b.id === batchId ? "text-amber" : "text-slate-warm-dark"}>
                  RUN #{String(b.id).padStart(4, "0")}
                </Silk>
                <div className="num mt-2 text-[11px] text-cream">
                  {b.startDate} → {b.endDate}
                </div>
                <div className="mt-1 text-[10px] text-slate-warm-dark">
                  {b.matchedRows} rows · {b.frequency}
                </div>
              </a>
            ))}
          </div>
        )}
      </Panel>

      {batch ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="border border-rule bg-charcoal-900 px-5 py-5">
            <Silk className="text-slate-warm-dark">SOURCE ROWS IN PERIOD</Silk>
            <div className="num mt-3 text-[28px] leading-none font-semibold text-cream">
              {batch.sourceRows.toLocaleString()}
            </div>
          </div>
          <div className="border border-rule bg-charcoal-900 px-5 py-5">
            <Silk className="text-slate-warm-dark">INCLUDED IN REPORTS</Silk>
            <div className="num mt-3 text-[28px] leading-none font-semibold text-teal-light">
              {batch.matchedRows.toLocaleString()}
            </div>
          </div>
          <div className="border border-rule bg-charcoal-900 px-5 py-5">
            <Silk className="text-slate-warm-dark">HELD FOR REVIEW</Silk>
            <div className="num mt-3 text-[28px] leading-none font-semibold text-amber">
              {batch.unmatchedRows.toLocaleString()}
            </div>
          </div>
          <div className="border border-rule bg-charcoal-900 px-5 py-5">
            <Silk className="text-slate-warm-dark">REPORTED REVENUE</Silk>
            <div className="num mt-3 text-[28px] leading-none font-semibold text-amber">
              {money(batch.matchedRevenue)}
            </div>
            <div className="mt-2 silk-sm text-slate-warm-dark">UNRECONCILED · NOT FINAL</div>
          </div>
        </div>
      ) : null}

      <Panel
        code="WORKBOOKS"
        title={batch ? `Run #${String(batch.id).padStart(4, "0")} · ${batch.startDate} → ${batch.endDate}` : "Workbooks"}
        tone="paper"
        right={
          reports.length ? (
            <Silk className="text-slate-warm-dark">
              {reports.length} WORKBOOK{reports.length === 1 ? "" : "S"} · 1 WORKSHEET EACH
            </Silk>
          ) : undefined
        }
      >
        {reports.length === 0 ? (
          <div className="p-5">
            <EmptyState
              code="00"
              title="No workbooks in this run"
              body="Either the period contains no matched rows, or every record is still awaiting a service mapping."
            />
          </div>
        ) : (
          <LedgerTable
            head={["Partner", "Service", "Filename", "Rows", "Count total", "Revenue total", "Size", "Status", "Action"]}
            minWidth={1260}
          >
            {reports.map((r) => {
              const partner = partnerById.get(r.partnerId);
              return (
                <tr key={r.id}>
                  <td>
                    <div className="text-[12px] font-semibold">{partner?.name ?? "—"}</div>
                    <div className="mt-1">
                      <Mono className="text-[10px] text-slate-warm-dark">{r.partnerCode}</Mono>
                    </div>
                  </td>
                  <td>
                    <Mono className="text-[11.5px] font-semibold text-amber-dark">{r.serviceName}</Mono>
                  </td>
                  <td>
                    <div className="flex items-start gap-2">
                      <FileSpreadsheet size={12} className="mt-[3px] shrink-0 text-slate-warm-dark" strokeWidth={1.8} />
                      <Mono className="max-w-[300px] truncate text-[10.5px]">{r.filename}</Mono>
                    </div>
                    <div className="mt-1.5 pl-[20px] text-[9.5px] uppercase tracking-[0.16em] text-slate-warm-dark">
                      Worksheet “Unreconciled Logs” · 9 columns
                    </div>
                  </td>
                  <td className="num r">{r.rowCount.toLocaleString()}</td>
                  <td className="num r">{r.countTotal.toLocaleString()}</td>
                  <td className="num r">{money(r.revenueTotal)}</td>
                  <td className="num r">{(r.fileSize / 1024).toFixed(1)} KB</td>
                  <td>
                    <StatusPill status={r.status} />
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                      <a
                        href={`/api/reports/${r.id}/download`}
                        className="btn btn-ghost"
                        title="Download the workbook from private storage"
                      >
                        <Eye size={11} strokeWidth={2} />
                        Download workbook
                      </a>
                      {canSend(user) ? (
                        <form action={sendReportAction}>
                          <input type="hidden" name="reportId" value={r.id} />
                          <button type="submit" className="btn btn-amber">
                            <Send size={11} strokeWidth={2} />
                            Send
                          </button>
                        </form>
                      ) : (
                        <Silk className="text-slate-warm-dark">NO SEND PERMISSION</Silk>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </LedgerTable>
        )}
      </Panel>

      <Panel code="FILENAME CONVENTION" title="How workbooks are named">
        <div className="dark-ink border border-rule bg-charcoal-900 p-5">
          <Mono className="text-[12px] text-amber">
            BRICCS_VAS_Report_[PartnerCode]_[SERVICE_NAME]_[StartDate]_[EndDate].xlsx
          </Mono>
          <p className="mt-4 text-[11.5px] leading-[1.85] text-slate-warm">
            Example:{" "}
            <Mono className="text-slate-warm">
              BRICCS_VAS_Report_PARTNER01_GAMEZONE_2026-10-09_2026-10-11.xlsx
            </Mono>
            . Every filename is sanitised to remove path characters before it is written to
            private storage, and reports are never exposed through permanent public URLs.
          </p>
        </div>
      </Panel>
    </div>
  );
}
