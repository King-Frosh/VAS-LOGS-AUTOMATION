import { desc, eq } from "drizzle-orm";
import { UploadCloud, Trash2, FileWarning, Copy } from "lucide-react";
import { db } from "@/db";
import { uploads, vasLogRows } from "@/db/schema";
import { requireUser, canManage } from "@/lib/auth";
import { ensureSeeded } from "@/lib/seed";
import { uploadLogsAction, deleteUploadAction } from "../actions";
import {
  PageHead,
  Panel,
  Flash,
  StatusPill,
  LedgerTable,
  Silk,
  EmptyState,
  fmtDateTime,
} from "@/components/console-ui";

export const dynamic = "force-dynamic";

export default async function UploadsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; msg?: string }>;
}) {
  await ensureSeeded();
  const user = await requireUser();
  const sp = await searchParams;
  const all = await db.select().from(uploads).orderBy(desc(uploads.id));

  const rowCounts = new Map<number, { matched: number; unmatched: number; invalid: number }>();
  for (const u of all) {
    const rows = await db.select().from(vasLogRows).where(eq(vasLogRows.uploadId, u.id));
    rowCounts.set(u.id, {
      matched: rows.filter((r) => r.matchStatus === "matched").length,
      unmatched: rows.filter((r) => r.matchStatus.startsWith("unmatched")).length,
      invalid: rows.filter((r) => r.matchStatus === "invalid").length,
    });
  }

  return (
    <div className="space-y-9">
      <PageHead
        eyebrow="MODULE 02 · UPLOAD LOGS"
        title="Source log intake"
        description="Upload the MTN unreconciled transaction log in its original form. The file is stored privately with its SHA-256 hash, uploader and timestamp. Identical content to a previous upload raises a warning — it is never discarded automatically."
      />

      <Flash status={sp.status} msg={sp.msg} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Panel code="STEP 01" title="Upload an unreconciled log">
          <form action={uploadLogsAction} className="space-y-5">
            <div>
              <label htmlFor="file" className="silk-sm text-slate-warm-dark">
                SOURCE FILE · .XLSX / .XLS / .CSV · MAX 25 MB
              </label>
              <input
                id="file"
                name="file"
                type="file"
                accept=".xlsx,.xls,.csv"
                required
                className="field field-dark mt-3 cursor-pointer file:mr-3 file:rounded-[2px] file:border-0 file:bg-amber file:px-3 file:py-1.5 file:text-[10px] file:font-semibold file:uppercase file:tracking-[0.14em] file:text-charcoal"
              />
            </div>

            <div className="border border-rule bg-charcoal-900 p-4">
              <Silk className="text-amber-dark">REQUIRED MTN SOURCE HEADERS</Silk>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {[
                  "DATE",
                  "SERVICE PARTNER",
                  "SERVICE ID",
                  "PRICE POINT",
                  "PRODUCT ID",
                  "PRODUCT NAME",
                  "TRANSACTION",
                  "COUNT",
                  "REVENUE",
                ].map((h, i) => (
                  <span
                    key={h}
                    className="num border border-rule px-2 py-1 text-[9.5px] tracking-[0.08em] text-slate-warm"
                  >
                    {String(i + 1).padStart(2, "0")} {h}
                  </span>
                ))}
              </div>
              <p className="mt-4 text-[11px] leading-[1.8] text-slate-warm-dark">
                Header capitalisation and surrounding whitespace are tolerated. Missing,
                duplicated or ambiguous required columns block processing before any report is
                generated.
              </p>
            </div>

            <button type="submit" className="btn btn-amber w-full justify-center py-3.5">
              <UploadCloud size={13} strokeWidth={2.2} />
              Upload and validate
            </button>
          </form>
        </Panel>

        <Panel code="VALIDATION" title="What the intake checks">
          <ol className="space-y-px">
            {[
              ["Extension and content", "The file must be a genuine .xlsx, .xls or .csv workbook, not merely renamed."],
              ["Header integrity", "All nine MTN columns present exactly once and in their original order."],
              ["Date interpretation", "Excel serials, ISO and day-first dates are all resolved to YYYY-MM-DD."],
              ["Numeric integrity", "COUNT and REVENUE must parse as numbers at the configured precision."],
              ["Partner and service mapping", "SERVICE PARTNER resolves to the register; SERVICE ID resolves to the service mapping."],
              ["Duplicate content", "A matching SHA-256 hash warns you before the same file is processed twice."],
            ].map(([t, b], i) => (
              <li key={t} className="flex gap-4 border-b border-rule py-4 last:border-0">
                <span className="num shrink-0 text-[11px] text-amber-dark">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <div className="text-[12.5px] font-semibold text-cream">{t}</div>
                  <p className="mt-1.5 text-[11.5px] leading-[1.75] text-slate-warm">{b}</p>
                </div>
              </li>
            ))}
          </ol>
        </Panel>
      </div>

      <Panel code="UPLOAD REGISTER" title="Stored source files" tone="paper">
        {all.length === 0 ? (
          <div className="p-5">
            <EmptyState
              code="00"
              title="No source files yet"
              body="Upload an MTN unreconciled log above. Originals are kept separate from generated reports and are never modified."
            />
          </div>
        ) : (
          <LedgerTable
            head={["File", "Uploaded by", "Rows", "Matched", "Unmatched", "Invalid", "Hash / duplicate", "Status", "Action"]}
            minWidth={1180}
          >
            {all.map((u) => {
              const c = rowCounts.get(u.id) ?? { matched: 0, unmatched: 0, invalid: 0 };
              return (
                <tr key={u.id}>
                  <td>
                    <div className="num max-w-[230px] truncate text-[11.5px] font-semibold">{u.filename}</div>
                    <div className="mt-1 text-[10.5px] text-slate-warm-dark">
                      {u.sizeBytes.toLocaleString()} bytes · {fmtDateTime(u.createdAt)}
                    </div>
                  </td>
                  <td className="text-[11.5px]">{u.uploaderName || "—"}</td>
                  <td className="num r">{u.totalRows.toLocaleString()}</td>
                  <td className="num r">{c.matched.toLocaleString()}</td>
                  <td className="num r">
                    <span className={c.unmatched ? "text-amber-dark" : ""}>{c.unmatched.toLocaleString()}</span>
                  </td>
                  <td className="num r">
                    <span className={c.invalid ? "text-alert" : ""}>{c.invalid.toLocaleString()}</span>
                  </td>
                  <td>
                    {u.duplicateOfUploadId ? (
                      <span className="inline-flex items-center gap-1.5 text-[10.5px] text-amber-dark">
                        <Copy size={11} strokeWidth={2} />
                        duplicate of #{u.duplicateOfUploadId}
                      </span>
                    ) : (
                      <span className="num text-[10px] text-slate-warm-dark">
                        {u.sha256.slice(0, 12)}…
                      </span>
                    )}
                  </td>
                  <td>
                    <StatusPill status={u.status} />
                    {u.headerIssues?.length ? (
                      <div className="mt-1.5 flex items-start gap-1.5 text-[10px] leading-tight text-amber-dark">
                        <FileWarning size={10} strokeWidth={2} className="mt-[1px] shrink-0" />
                        <span>{u.headerIssues[0]}</span>
                      </div>
                    ) : null}
                  </td>
                  <td>
                    {canManage(user) ? (
                      <form action={deleteUploadAction}>
                        <input type="hidden" name="id" value={u.id} />
                        <button type="submit" className="btn btn-ghost">
                          <Trash2 size={11} strokeWidth={2} />
                          Remove
                        </button>
                      </form>
                    ) : (
                      <Silk className="text-slate-warm-dark">READ ONLY</Silk>
                    )}
                  </td>
                </tr>
              );
            })}
          </LedgerTable>
        )}
      </Panel>
    </div>
  );
}
