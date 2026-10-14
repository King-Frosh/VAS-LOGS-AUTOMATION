import { desc, sql, eq } from "drizzle-orm";
import { Unlink, ArrowRight, Download } from "lucide-react";
import { db } from "@/db";
import { vasLogRows, uploads } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { ensureSeeded } from "@/lib/seed";
import {
  PageHead,
  Panel,
  Flash,
  StatusPill,
  LedgerTable,
  Silk,
  EmptyState,
  Mono,
  money,
} from "@/components/console-ui";

export const dynamic = "force-dynamic";

export default async function UnmatchedPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; msg?: string }>;
}) {
  await ensureSeeded();
  await requireUser();
  const sp = await searchParams;

  const rows = await db
    .select()
    .from(vasLogRows)
    .where(sql`${vasLogRows.matchStatus} like 'unmatched%'`)
    .orderBy(desc(vasLogRows.id))
    .limit(300);

  const uploadIds = [...new Set(rows.map((r) => r.uploadId))];
  const uploadRows = uploadIds.length
    ? await db.select().from(uploads).where(sql`${uploads.id} in (${sql.join(uploadIds.map((v) => sql`${v}`), sql`, `)})`)
    : [];
  const uploadById = new Map(uploadRows.map((u) => [u.id, u]));

  const [agg] = await db
    .select({
      n: sql<number>`count(*)::int`,
      count: sql<number>`coalesce(sum(${vasLogRows.countValue}),0)::int`,
      revenue: sql<string>`coalesce(sum(${vasLogRows.revenueValue}::numeric),0)`,
    })
    .from(vasLogRows)
    .where(sql`${vasLogRows.matchStatus} like 'unmatched%'`);

  const groups = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = r.matchStatus === "unmatched_partner" ? "SERVICE PARTNER not registered" : "SERVICE ID not mapped";
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }

  return (
    <div className="space-y-9">
      <PageHead
        eyebrow="MODULE 10 · UNMATCHED RECORDS"
        title="Records held outside partner reports"
        description="These source rows could not be matched with confidence, so they are excluded from every outgoing workbook until an administrator resolves them. They remain fully retained with their original source row numbers."
        actions={
          <a href="/console/services" className="btn btn-amber">
            Open service mapping
            <ArrowRight size={12} strokeWidth={2.2} />
          </a>
        }
      />

      <Flash status={sp.status} msg={sp.msg} />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="border border-rule bg-charcoal-900 px-5 py-5">
          <Silk className="text-slate-warm-dark">ROWS HELD</Silk>
          <div className="num mt-3 text-[30px] leading-none font-semibold text-alert">
            {(agg?.n ?? 0).toLocaleString()}
          </div>
        </div>
        <div className="border border-rule bg-charcoal-900 px-5 py-5">
          <Silk className="text-slate-warm-dark">COUNT VALUE WITHHELD</Silk>
          <div className="num mt-3 text-[30px] leading-none font-semibold text-amber">
            {(agg?.count ?? 0).toLocaleString()}
          </div>
        </div>
        <div className="border border-rule bg-charcoal-900 px-5 py-5">
          <Silk className="text-slate-warm-dark">REVENUE VALUE WITHHELD</Silk>
          <div className="num mt-3 text-[30px] leading-none font-semibold text-amber">
            {money(agg?.revenue)}
          </div>
          <div className="mt-2 silk-sm text-slate-warm-dark">ACCOUNTED FOR IN RECONCILIATION</div>
        </div>
      </div>

      {[...groups.entries()].map(([title, list]) => (
        <Panel
          key={title}
          code={title.includes("PARTNER") ? "REGISTER GAP" : "MAPPING GAP"}
          title={`${title} · ${list.length} record${list.length === 1 ? "" : "s"}`}
          tone="paper"
          right={
            <a
              href={`/api/unmatched/export?status=${title.includes("PARTNER") ? "unmatched_partner" : "unmatched_service"}`}
              className="btn btn-dark"
            >
              <Download size={11} strokeWidth={2.2} />
              Export for review
            </a>
          }
        >
          <LedgerTable
            head={["Source row", "Date", "SERVICE PARTNER", "SERVICE ID", "PRODUCT NAME", "Transaction", "Count", "Revenue", "Status", "Reason"]}
            minWidth={1360}
          >
            {list.map((r) => (
              <tr key={r.id}>
                <td>
                  <Mono className="text-[10.5px] font-semibold">
                    #{String(r.sourceRow).padStart(5, "0")}
                  </Mono>
                  <div className="mt-1 text-[9px] text-slate-warm-dark">
                    {uploadById.get(r.uploadId)?.filename.slice(0, 22) ?? "—"}
                  </div>
                </td>
                <td>
                  <Mono className="text-[10.5px]">{r.logDate ?? (r.rawDate || "—")}</Mono>
                </td>
                <td>
                  <Mono className="max-w-[220px] truncate text-[10.5px]">{r.servicePartner || "—"}</Mono>
                </td>
                <td>
                  <Mono className="text-[10.5px]">{r.serviceId || "—"}</Mono>
                </td>
                <td>
                  <Mono className="max-w-[180px] truncate text-[10px]">{r.productName || "—"}</Mono>
                </td>
                <td className="text-[10.5px]">{r.transaction || "—"}</td>
                <td className="num r">{(r.countValue ?? 0).toLocaleString()}</td>
                <td className="num r">{money(r.revenueValue)}</td>
                <td>
                  <StatusPill status={r.matchStatus} />
                </td>
                <td>
                  <div className="max-w-[300px] text-[9.5px] leading-[1.65] text-slate-warm-dark">
                    {r.issues || "—"}
                  </div>
                </td>
              </tr>
            ))}
          </LedgerTable>
        </Panel>
      ))}

      {rows.length === 0 ? (
        <EmptyState
          code="OK"
          title="Nothing is waiting for review"
          body="Every source row in storage has been matched to a registered partner and a mapped service. Re-run matching from the Service Mapping register whenever the register changes."
          action={
            <a href="/console/services" className="btn btn-ghost">
              <Unlink size={12} strokeWidth={2.2} />
              Service mapping register
            </a>
          }
        />
      ) : null}
    </div>
  );
}
