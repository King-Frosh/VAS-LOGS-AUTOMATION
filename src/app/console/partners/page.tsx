import { desc, eq, sql } from "drizzle-orm";
import { Building2, Power, Pencil, Plus } from "lucide-react";
import { db } from "@/db";
import { partners, services, partnerReports, emailDeliveries } from "@/db/schema";
import { requireUser, canManage } from "@/lib/auth";
import { ensureSeeded } from "@/lib/seed";
import { savePartnerAction, togglePartnerAction } from "../actions";
import {
  PageHead,
  Panel,
  Flash,
  StatusPill,
  LedgerTable,
  Silk,
  EmptyState,
  Mono,
} from "@/components/console-ui";

export const dynamic = "force-dynamic";

export default async function PartnersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; msg?: string; edit?: string }>;
}) {
  await ensureSeeded();
  const user = await requireUser();
  const sp = await searchParams;
  const editId = Number(sp.edit || 0);

  const all = await db.select().from(partners).orderBy(desc(partners.id));
  const serviceCounts = new Map<number, number>();
  const svcRows = await db.select().from(services);
  for (const s of svcRows) {
    serviceCounts.set(s.partnerId, (serviceCounts.get(s.partnerId) ?? 0) + 1);
  }

  const reportCounts = await db
    .select({ partnerId: partnerReports.partnerId, n: sql<number>`count(*)::int` })
    .from(partnerReports)
    .groupBy(partnerReports.partnerId);
  const deliveryCounts = await db
    .select({
      partnerId: emailDeliveries.partnerId,
      n: sql<number>`count(*) filter (where ${emailDeliveries.status} = 'Sent/Accepted')::int`,
    })
    .from(emailDeliveries)
    .groupBy(emailDeliveries.partnerId);

  const editing = editId ? all.find((p) => p.id === editId) : undefined;

  return (
    <div className="space-y-9">
      <PageHead
        eyebrow="MODULE 05 · PARTNER REGISTER"
        title="Partner recipients and delivery preferences"
        description="The SERVICE PARTNER column is matched against this register. Matching ignores capitalisation and surrounding spaces, but an ambiguous or unknown match is never guessed — it is held for review instead."
        actions={
          canManage(user) ? (
            <a href="/console/partners" className="btn btn-amber">
              <Plus size={13} strokeWidth={2.2} />
              New partner
            </a>
          ) : (
            <Silk className="text-slate-warm-dark">READ-ONLY REVIEWER · NO EDITS</Silk>
          )
        }
      />

      <Flash status={sp.status} msg={sp.msg} />

      {canManage(user) ? (
        <Panel
          code={editing ? `EDIT · ${editing.code}` : "NEW ENTRY"}
          title={editing ? `Update ${editing.name}` : "Add a partner to the register"}
        >
          <form action={savePartnerAction} className="space-y-5">
            {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="name" className="silk-sm text-slate-warm-dark">
                  OFFICIAL PARTNER NAME
                </label>
                <input
                  id="name"
                  name="name"
                  defaultValue={editing?.name ?? ""}
                  placeholder="Telewings Media Limited"
                  required
                  className="field field-dark mt-2.5"
                />
                <p className="mt-2 text-[10.5px] leading-[1.7] text-slate-warm-dark">
                  Must match the SERVICE PARTNER values used in the MTN log.
                </p>
              </div>
              <div>
                <label htmlFor="code" className="silk-sm text-slate-warm-dark">
                  PARTNER CODE · USED IN FILENAMES
                </label>
                <input
                  id="code"
                  name="code"
                  defaultValue={editing?.code ?? ""}
                  placeholder="TWL"
                  required
                  className="field field-dark mt-2.5 uppercase"
                />
              </div>
              <div>
                <label htmlFor="primaryEmail" className="silk-sm text-slate-warm-dark">
                  PRIMARY RECIPIENT · {"{{partner_mail address}}"}
                </label>
                <input
                  id="primaryEmail"
                  name="primaryEmail"
                  type="email"
                  defaultValue={editing?.primaryEmail ?? ""}
                  placeholder="revenue.assurance@partner.example"
                  required
                  className="field field-dark mt-2.5"
                />
              </div>
              <div>
                <label htmlFor="ccEmails" className="silk-sm text-slate-warm-dark">
                  CC RECIPIENTS · COMMA SEPARATED
                </label>
                <input
                  id="ccEmails"
                  name="ccEmails"
                  defaultValue={editing?.ccEmails ?? ""}
                  placeholder="finance@partner.example, audit@partner.example"
                  className="field field-dark mt-2.5"
                />
              </div>
              <div>
                <label htmlFor="frequency" className="silk-sm text-slate-warm-dark">
                  DELIVERY FREQUENCY
                </label>
                <select
                  id="frequency"
                  name="frequency"
                  defaultValue={editing?.frequency ?? "daily"}
                  className="field field-dark mt-2.5"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div>
                <label htmlFor="notes" className="silk-sm text-slate-warm-dark">
                  INTERNAL NOTES
                </label>
                <input
                  id="notes"
                  name="notes"
                  defaultValue={editing?.notes ?? ""}
                  placeholder="Escalation contact, contract reference…"
                  className="field field-dark mt-2.5"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <label className="flex cursor-pointer items-center gap-2.5 border border-rule bg-charcoal-900 px-4 py-3">
                <input
                  type="checkbox"
                  name="active"
                  defaultChecked={editing ? editing.active : true}
                  className="h-4 w-4 accent-[#FFB000]"
                />
                <span className="text-[11.5px] text-cream">Partner active</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2.5 border border-rule bg-charcoal-900 px-4 py-3">
                <input
                  type="checkbox"
                  name="autoDelivery"
                  defaultChecked={editing?.autoDelivery ?? false}
                  className="h-4 w-4 accent-[#FFB000]"
                />
                <span className="text-[11.5px] text-cream">
                  Automatic report delivery on the {editing?.frequency ?? "daily"} schedule
                </span>
              </label>
            </div>

            <div className="flex gap-3">
              <button type="submit" className="btn btn-amber">
                {editing ? "Save changes" : "Add partner"}
              </button>
              {editing ? (
                <a href="/console/partners" className="btn btn-ghost">
                  Cancel
                </a>
              ) : null}
            </div>
          </form>
        </Panel>
      ) : null}

      <Panel code="REGISTER" title="Registered partners" tone="paper">
        {all.length === 0 ? (
          <div className="p-5">
            <EmptyState code="00" title="No partners registered" body="Add a partner so SERVICE PARTNER values can be matched and reports delivered." />
          </div>
        ) : (
          <LedgerTable
            head={["Partner", "Code", "Primary recipient", "CC", "Services", "Reports", "Delivered", "Cadence", "Automation", "Status", "Action"]}
            minWidth={1380}
          >
            {all.map((p) => {
              const rep = reportCounts.find((r) => r.partnerId === p.id)?.n ?? 0;
              const del = deliveryCounts.find((r) => r.partnerId === p.id)?.n ?? 0;
              return (
                <tr key={p.id}>
                  <td>
                    <div className="flex items-start gap-2.5">
                      <Building2 size={13} className="mt-[3px] shrink-0 text-slate-warm-dark" strokeWidth={1.8} />
                      <div>
                        <div className="text-[12px] font-semibold">{p.name}</div>
                        {p.notes ? <div className="mt-1 text-[10px] text-slate-warm-dark">{p.notes}</div> : null}
                      </div>
                    </div>
                  </td>
                  <td>
                    <Mono className="text-[11px] font-semibold">{p.code}</Mono>
                  </td>
                  <td>
                    <Mono className="text-[10.5px]">{p.primaryEmail}</Mono>
                  </td>
                  <td>
                    <Mono className="text-[10.5px] text-slate-warm-dark">{p.ccEmails || "—"}</Mono>
                  </td>
                  <td className="num r">{serviceCounts.get(p.id) ?? 0}</td>
                  <td className="num r">{rep}</td>
                  <td className="num r">{del}</td>
                  <td className="text-[10.5px] uppercase tracking-[0.12em]">{p.frequency}</td>
                  <td>
                    {p.autoDelivery ? (
                      <Silk className="text-teal-light">ENABLED</Silk>
                    ) : (
                      <Silk className="text-slate-warm-dark">DISABLED</Silk>
                    )}
                  </td>
                  <td>
                    <StatusPill status={p.active ? "active" : "inactive"} />
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                      <a href={`/console/partners?edit=${p.id}`} className="btn btn-ghost">
                        <Pencil size={11} strokeWidth={2} />
                        Edit
                      </a>
                      <form action={togglePartnerAction}>
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="active" value={String(p.active)} />
                        <button type="submit" className="btn btn-ghost">
                          <Power size={11} strokeWidth={2} />
                          {p.active ? "Deactivate" : "Activate"}
                        </button>
                      </form>
                    </div>
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
