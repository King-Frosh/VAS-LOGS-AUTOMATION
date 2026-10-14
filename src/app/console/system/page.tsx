import { ShieldCheck, Users, Database, HardDrive, FileSpreadsheet, KeyRound } from "lucide-react";
import { db } from "@/db";
import { sql, eq } from "drizzle-orm";
import { users, uploads, vasLogRows, partnerReports, emailDeliveries } from "@/db/schema";
import { requireUser, ROLE_LABEL } from "@/lib/auth";
import { ensureSeeded } from "@/lib/seed";
import { PageHead, Panel, Flash, Silk, LedgerTable, Mono, StatusPill } from "@/components/console-ui";

export const dynamic = "force-dynamic";

export default async function SystemPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; msg?: string }>;
}) {
  await ensureSeeded();
  await requireUser();
  const sp = await searchParams;

  const userRows = await db.select().from(users);
  const [agg] = await db
    .select({
      uploads: sql<number>`(select count(*) from uploads)::int`,
      rows: sql<number>`(select count(*) from vas_log_rows)::int`,
      reports: sql<number>`(select count(*) from partner_reports)::int`,
      deliveries: sql<number>`(select count(*) from email_deliveries)::int`,
    })
    .from(uploads)
    .limit(1)
    .catch(() => [{ uploads: 0, rows: 0, reports: 0, deliveries: 0 }]);

  return (
    <div className="space-y-9">
      <PageHead
        eyebrow="MODULE 15 · SYSTEM SETTINGS"
        title="Access control, storage and operations"
        description="Role-based permissions govern who may configure SMTP, maintain the registers, generate reports and send partner mail. Original source files and generated workbooks remain in private storage behind authenticated routes."
      />

      <Flash status={sp.status} msg={sp.msg} />

      <Panel code="ACCESS CONTROL" title="Roles and permissions" tone="paper">
        <LedgerTable
          head={["Role", "Registers & mapping", "Upload & process", "Generate workbooks", "Send email", "SMTP & automation", "View history"]}
          minWidth={1120}
        >
          {[
            ["Administrator", "Full", "Full", "Full", "Full", "Full", "Full"],
            ["Operations user", "View", "Full", "Full", "Within permissions", "No", "Full"],
            ["Read-only reviewer", "View", "No", "No", "No", "No", "Authorised"],
          ].map((r) => (
            <tr key={r[0]}>
              <td className="text-[12px] font-semibold">{r[0]}</td>
              {r.slice(1).map((c, i) => (
                <td key={i} className="text-[11px]">
                  {c === "No" ? (
                    <span className="text-slate-warm-dark">{c}</span>
                  ) : c === "Full" ? (
                    <span className="text-teal-light">{c}</span>
                  ) : (
                    <span className="text-amber">{c}</span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </LedgerTable>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,6fr)_minmax(0,6fr)]">
        <Panel code="USERS" title="Console accounts">
          <ul className="space-y-px">
            {userRows.map((u) => (
              <li
                key={u.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-rule py-3.5 last:border-0"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5">
                    <Users size={12} className="text-slate-warm-dark" strokeWidth={1.9} />
                    <span className="text-[12px] font-semibold text-cream">{u.name}</span>
                  </div>
                  <Mono className="mt-1.5 block text-[10px] text-slate-warm-dark">{u.email}</Mono>
                </div>
                <div className="flex items-center gap-3">
                  <Silk className="text-amber-dark">
                    {ROLE_LABEL[u.role as keyof typeof ROLE_LABEL]?.toUpperCase() ?? u.role.toUpperCase()}
                  </Silk>
                  <StatusPill status={u.active ? "active" : "inactive"} />
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <div className="space-y-6">
          <Panel code="STORAGE" title="Private storage inventory">
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: Database, label: "Source rows retained", value: agg?.rows ?? 0 },
                { icon: HardDrive, label: "Original files stored", value: agg?.uploads ?? 0 },
                { icon: FileSpreadsheet, label: "Workbooks generated", value: agg?.reports ?? 0 },
                { icon: KeyRound, label: "Delivery records", value: agg?.deliveries ?? 0 },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="border border-rule bg-charcoal-900 p-4">
                  <Icon size={14} className="text-amber-dark" strokeWidth={1.8} />
                  <div className="num mt-3 text-[22px] leading-none font-semibold text-cream">
                    {(value ?? 0).toLocaleString()}
                  </div>
                  <div className="mt-2 text-[10.5px] leading-tight text-slate-warm">{label}</div>
                </div>
              ))}
            </div>
            <p className="mt-5 text-[10.5px] leading-[1.85] text-slate-warm">
              Originals are stored separately from generated reports and are never modified in
              place. Downloads are served through authenticated routes — no permanent public file
              URLs are created.
            </p>
          </Panel>

          <Panel code="DATA INTEGRITY" title="Controls in force">
            <ul className="space-y-px">
              {[
                ["Source fidelity", "Original values and source row numbers are retained verbatim alongside the parsed record."],
                ["Identifier precision", "SERVICE ID, PRODUCT ID and PRICE POINT are stored as text so leading zeroes survive."],
                ["Revenue precision", "Revenue is held as a fixed-precision decimal, never as a floating-point approximation."],
                ["Snapshot records", "Recipient, subject and body used for each email are retained even after templates change."],
                ["Formula injection defence", "Every generated cell is sanitised before it is written into an .xlsx workbook."],
                ["Retention", "A retention policy governs how long source files, reports and delivery history are kept."],
              ].map(([t, b]) => (
                <li key={t} className="flex gap-3 border-b border-rule py-3.5 last:border-0">
                  <ShieldCheck size={12} className="mt-[3px] shrink-0 text-teal-light" strokeWidth={2} />
                  <div>
                    <div className="text-[11.5px] font-semibold text-cream">{t}</div>
                    <p className="mt-1 text-[10.5px] leading-[1.75] text-slate-warm">{b}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}
