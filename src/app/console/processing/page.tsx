import { desc, eq, sql } from "drizzle-orm";
import { CalendarRange, Play, CheckCircle2, AlertTriangle } from "lucide-react";
import { db } from "@/db";
import { reportBatches, partnerReports, vasLogRows } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { ensureSeeded } from "@/lib/seed";
import { generateBatchAction } from "../actions";
import {
  PageHead,
  Panel,
  Flash,
  Metric,
  StatusPill,
  LedgerTable,
  Silk,
  EmptyState,
  fmtDateTime,
  money,
} from "@/components/console-ui";

export const dynamic = "force-dynamic";

export default async function ProcessingPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; msg?: string }>;
}) {
  await ensureSeeded();
  await requireUser();
  const sp = await searchParams;

  const today = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const defaultStart = iso(new Date(today.getTime() - 6 * 86_400_000));
  const defaultEnd = iso(today);

  const batches = await db.select().from(reportBatches).orderBy(desc(reportBatches.id)).limit(12);

  const [rowAgg] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(vasLogRows)
    .where(eq(vasLogRows.matchStatus, "matched"));

  return (
    <div className="space-y-9">
      <PageHead
        eyebrow="MODULE 03 · DATE RANGE & PROCESSING"
        title="Generate partner-service workbooks"
        description="Select an inclusive reporting period. Each eligible partner-service combination produces exactly one .xlsx workbook containing a single worksheet named “Unreconciled Logs”, and each workbook becomes one email with that workbook attached."
      />

      <Flash status={sp.status} msg={sp.msg} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Panel code="STEP 02" title="Select the reporting period">
          <form action={generateBatchAction} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="startDate" className="silk-sm text-slate-warm-dark">
                  INCLUSIVE START DATE
                </label>
                <input
                  id="startDate"
                  name="startDate"
                  type="date"
                  defaultValue={defaultStart}
                  required
                  className="field field-dark mt-2.5"
                />
              </div>
              <div>
                <label htmlFor="endDate" className="silk-sm text-slate-warm-dark">
                  INCLUSIVE END DATE
                </label>
                <input
                  id="endDate"
                  name="endDate"
                  type="date"
                  defaultValue={defaultEnd}
                  required
                  className="field field-dark mt-2.5"
                />
              </div>
            </div>

            <div>
              <label htmlFor="frequency" className="silk-sm text-slate-warm-dark">
                REPORTING CADENCE
              </label>
              <select id="frequency" name="frequency" defaultValue="daily" className="field field-dark mt-2.5">
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>

            <label className="flex cursor-pointer items-start gap-3 border border-rule bg-charcoal-900 p-4">
              <input
                type="checkbox"
                name="autoSend"
                className="mt-[3px] h-4 w-4 shrink-0 accent-[#FFB000]"
              />
              <span>
                <span className="block text-[12px] font-semibold text-cream">
                  Send immediately after generation
                </span>
                <span className="mt-1.5 block text-[11px] leading-[1.75] text-slate-warm">
                  Only eligible partners with automatic delivery enabled will receive mail. Empty
                  reports are never sent, and a send is blocked whenever its workbook is missing.
                </span>
              </span>
            </label>

            <button type="submit" className="btn btn-amber w-full justify-center py-3.5">
              <CalendarRange size={13} strokeWidth={2.2} />
              Validate and generate workbooks
            </button>
          </form>
        </Panel>

        <Panel code="RECONCILIATION RULE" title="Every valid row must be accounted for">
          <div className="border border-rule bg-charcoal-900 p-6">
            <Silk className="text-amber-dark">CONTROL EQUATION</Silk>
            <div className="num mt-4 space-y-2 text-[12.5px] leading-[1.9] text-cream">
              <div>valid source total = matched report totals</div>
              <div className="pl-6 text-slate-warm">+ valid unmatched totals</div>
            </div>
            <div className="mt-5 h-px bg-rule" />
            <p className="mt-5 text-[11.5px] leading-[1.85] text-slate-warm">
              The check runs for both record counts and revenue before a batch is marked ready to
              send. Invalid records and explicitly excluded data are accounted for separately.
              Records that cannot be reliably matched are excluded from partner reports and held
              in Unmatched Records until an administrator resolves the mapping.
            </p>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <Metric code="MATCHED ROWS" value={rowAgg?.total ?? 0} label="Available to report" tone="teal" />
            <Metric code="RUNS" value={batches.length} label="Processing runs recorded" tone="amber" />
            <Metric
              code="EMPTY REPORTS"
              value="0"
              label="Never generated or sent"
              tone="slate"
              sub="By policy"
            />
          </div>
        </Panel>
      </div>

      <Panel code="PROCESSING RUNS" title="Batch history" tone="paper">
        {batches.length === 0 ? (
          <div className="p-5">
            <EmptyState
              code="00"
              title="No processing runs recorded"
              body="Choose an inclusive start and end date above, then generate. Every run records its reconciliation totals."
            />
          </div>
        ) : (
          <LedgerTable
            head={["Run", "Period", "Source rows", "Matched", "Held", "Invalid", "Matched revenue", "Unmatched revenue", "Balanced", "Status"]}
            minWidth={1320}
          >
            {batches.map((b) => (
              <tr key={b.id}>
                <td>
                  <div className="num text-[11.5px] font-semibold">#{String(b.id).padStart(4, "0")}</div>
                  <div className="mt-1 text-[10.5px] text-slate-warm-dark">{fmtDateTime(b.createdAt)}</div>
                  <div className="mt-1 text-[10.5px] text-slate-warm-dark">{b.createdByName || "system"}</div>
                </td>
                <td className="num text-[11.5px]">
                  {b.startDate} → {b.endDate}
                  <div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-slate-warm-dark">
                    {b.frequency}
                  </div>
                </td>
                <td className="num r">{b.sourceRows.toLocaleString()}</td>
                <td className="num r">{b.matchedRows.toLocaleString()}</td>
                <td className="num r">
                  <span className={b.unmatchedRows ? "text-amber-dark" : ""}>{b.unmatchedRows.toLocaleString()}</span>
                </td>
                <td className="num r">
                  <span className={b.invalidRows ? "text-alert" : ""}>{b.invalidRows.toLocaleString()}</span>
                </td>
                <td className="num r">{money(b.matchedRevenue)}</td>
                <td className="num r">{money(b.unmatchedRevenue)}</td>
                <td>
                  {b.balanced ? (
                    <span className="inline-flex items-center gap-1.5 text-[10.5px] text-teal-light">
                      <CheckCircle2 size={11} strokeWidth={2} />
                      balanced
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-[10.5px] text-alert">
                      <AlertTriangle size={11} strokeWidth={2} />
                      review
                    </span>
                  )}
                </td>
                <td>
                  <StatusPill status={b.status} />
                </td>
              </tr>
            ))}
          </LedgerTable>
        )}
      </Panel>

      <Panel code="NEXT" title="Where these workbooks go">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            ["01", "Generated Reports", "Preview and download each partner-service workbook before anything is sent."],
            ["02", "Email Centre", "Review recipient, subject, body and attachment, then send individually or in bulk."],
            ["03", "Delivery History", "Every attempt, SMTP response, failure, retry and authorised resend is recorded."],
          ].map(([n, t, b]) => (
            <div key={n} className="border-l-2 border-amber/40 pl-5">
              <Silk className="text-amber-dark">{n}</Silk>
              <h3 className="mt-2.5 text-[13px] font-semibold text-cream">{t}</h3>
              <p className="mt-2 text-[11.5px] leading-[1.8] text-slate-warm">{b}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 flex items-center gap-3 border border-rule bg-charcoal-900 px-4 py-3.5">
          <Play size={13} className="shrink-0 text-amber" strokeWidth={2} />
          <p className="text-[11.5px] leading-[1.75] text-slate-warm">
            Long-running spreadsheet processing executes on the server. No browser window needs to
            remain open for generation or scheduled sending to complete.
          </p>
        </div>
      </Panel>
    </div>
  );
}
