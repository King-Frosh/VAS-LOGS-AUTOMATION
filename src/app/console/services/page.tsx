import { desc, eq, sql } from "drizzle-orm";
import { Cable, Plus, Power, Trash2, RefreshCw, Pencil } from "lucide-react";
import { db } from "@/db";
import { services, partners, vasLogRows } from "@/db/schema";
import { requireUser, canManage } from "@/lib/auth";
import { ensureSeeded } from "@/lib/seed";
import {
  saveServiceAction,
  toggleServiceAction,
  deleteServiceAction,
  rematchAllAction,
} from "../actions";
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

export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; msg?: string; edit?: string }>;
}) {
  await ensureSeeded();
  const user = await requireUser();
  const sp = await searchParams;
  const editId = Number(sp.edit || 0);

  const partnerRows = await db.select().from(partners).orderBy(partners.name);
  const serviceRows = await db.select().from(services).orderBy(desc(services.id));
  const partnerById = new Map(partnerRows.map((p) => [p.id, p]));

  const usage = await db
    .select({
      serviceIdRef: vasLogRows.serviceIdRef,
      n: sql<number>`count(*)::int`,
    })
    .from(vasLogRows)
    .groupBy(vasLogRows.serviceIdRef);
  const usageBy = new Map(usage.map((u) => [u.serviceIdRef, u.n]));

  const editing = editId ? serviceRows.find((s) => s.id === editId) : undefined;
  const unmapped = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(vasLogRows)
    .where(sql`${vasLogRows.matchStatus} like 'unmatched%'`);

  return (
    <div className="space-y-9">
      <PageHead
        eyebrow="MODULE 06 · SERVICE MAPPING REGISTER"
        title="Service ID → partner mapping"
        description="This register is the single source of truth for which Service ID and Service Name belong to which partner. It is maintained by hand, persists across every processing run, and can be extended at any time — add a new service here and it becomes reportable immediately. Nothing is ever inferred."
        actions={
          <>
            <form action={rematchAllAction}>
              <button type="submit" className="btn btn-ghost" disabled={!canManage(user)}>
                <RefreshCw size={13} strokeWidth={2.2} />
                Re-run matching
              </button>
            </form>
            <a href="#mapping-form" className="btn btn-amber">
              <Plus size={13} strokeWidth={2.2} />
              New mapping
            </a>
          </>
        }
      />

      <Flash status={sp.status} msg={sp.msg} />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="border border-rule bg-charcoal-900 px-5 py-5">
          <Silk className="text-slate-warm-dark">MAPPINGS HELD</Silk>
          <div className="num mt-3 text-[30px] leading-none font-semibold text-amber">
            {serviceRows.length}
          </div>
          <div className="mt-2.5 text-[11.5px] text-slate-warm">
            Service ID / Service Name pairs currently registered
          </div>
        </div>
        <div className="border border-rule bg-charcoal-900 px-5 py-5">
          <Silk className="text-slate-warm-dark">PARTNERS COVERED</Silk>
          <div className="num mt-3 text-[30px] leading-none font-semibold text-amber">
            {new Set(serviceRows.map((s) => s.partnerId)).size}
          </div>
          <div className="mt-2.5 text-[11.5px] text-slate-warm">
            Partners with at least one mapped service
          </div>
        </div>
        <div className="border border-rule bg-charcoal-900 px-5 py-5">
          <Silk className="text-slate-warm-dark">ROWS AWAITING A MAPPING</Silk>
          <div className="num mt-3 text-[30px] leading-none font-semibold text-alert">
            {unmapped[0]?.n ?? 0}
          </div>
          <div className="mt-2.5 text-[11.5px] text-slate-warm">
            Held in Unmatched Records, excluded from partner reports
          </div>
        </div>
      </div>

      {canManage(user) ? (
        <div id="mapping-form">
          <Panel
            code={editing ? `EDIT · ${editing.serviceId}` : "NEW MAPPING"}
            title={
              editing
                ? `Update the mapping for ${editing.serviceName}`
                : "Map a Service ID and Service Name to a partner"
            }
          >
            <form action={saveServiceAction} className="space-y-5">
              {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label htmlFor="partnerId" className="silk-sm text-slate-warm-dark">
                    PARTNER · FROM THE REGISTER
                  </label>
                  <select
                    id="partnerId"
                    name="partnerId"
                    defaultValue={editing?.partnerId ?? ""}
                    required
                    className="field field-dark mt-2.5"
                  >
                    <option value="">— select partner —</option>
                    {partnerRows.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="serviceId" className="silk-sm text-slate-warm-dark">
                    SERVICE ID · AS IT APPEARS IN THE LOG
                  </label>
                  <input
                    id="serviceId"
                    name="serviceId"
                    defaultValue={editing?.serviceId ?? ""}
                    placeholder="SVC-8801"
                    required
                    className="field field-dark mt-2.5 uppercase"
                  />
                  <p className="mt-2 text-[10.5px] leading-[1.7] text-slate-warm-dark">
                    Held as text so leading zeroes are preserved.
                  </p>
                </div>
                <div>
                  <label htmlFor="serviceName" className="silk-sm text-slate-warm-dark">
                    SERVICE NAME · USED IN SUBJECT AND FILENAME
                  </label>
                  <input
                    id="serviceName"
                    name="serviceName"
                    defaultValue={editing?.serviceName ?? ""}
                    placeholder="GAMEZONE"
                    required
                    className="field field-dark mt-2.5 uppercase"
                  />
                </div>
              </div>

              <label className="flex w-fit cursor-pointer items-center gap-2.5 border border-rule bg-charcoal-900 px-4 py-3">
                <input
                  type="checkbox"
                  name="active"
                  defaultChecked={editing ? editing.active : true}
                  className="h-4 w-4 accent-[#FFB000]"
                />
                <span className="text-[11.5px] text-cream">Mapping active</span>
              </label>

              <div className="flex flex-wrap gap-3">
                <button type="submit" className="btn btn-amber">
                  {editing ? "Save mapping" : "Add to register"}
                </button>
                {editing ? (
                  <a href="/console/services" className="btn btn-ghost">
                    Cancel
                  </a>
                ) : null}
              </div>
            </form>
          </Panel>
        </div>
      ) : null}

      <Panel
        code="MAPPING REGISTER"
        title="Saved mappings — available to every future run"
        tone="paper"
        right={<Silk className="text-slate-warm-dark">PERSISTENT · EDITABLE · VERSIONED IN THE AUDIT LOG</Silk>}
      >
        {serviceRows.length === 0 ? (
          <div className="p-5">
            <EmptyState
              code="00"
              title="No services mapped yet"
              body="Add a Service ID and Service Name above and assign it to a partner. Until a service is mapped, its records stay in Unmatched Records and never reach a partner report."
            />
          </div>
        ) : (
          <LedgerTable
            head={["Service ID", "Service Name", "Partner", "Partner code", "Rows seen", "Status", "Action"]}
            minWidth={1080}
          >
            {serviceRows.map((s) => {
              const partner = partnerById.get(s.partnerId);
              return (
                <tr key={s.id}>
                  <td>
                    <Mono className="text-[11.5px] font-semibold">{s.serviceId}</Mono>
                  </td>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <Cable size={12} className="text-slate-warm-dark" strokeWidth={1.8} />
                      <span className="text-[12px] font-semibold">{s.serviceName}</span>
                    </div>
                  </td>
                  <td className="text-[11.5px]">{partner?.name ?? "—"}</td>
                  <td>
                    <Mono className="text-[10.5px] text-slate-warm-dark">{partner?.code ?? "—"}</Mono>
                  </td>
                  <td className="num r">{(usageBy.get(s.id) ?? 0).toLocaleString()}</td>
                  <td>
                    <StatusPill status={s.active ? "active" : "inactive"} />
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                      <a href={`/console/services?edit=${s.id}`} className="btn btn-ghost">
                        <Pencil size={11} strokeWidth={2} />
                        Edit
                      </a>
                      <form action={toggleServiceAction}>
                        <input type="hidden" name="id" value={s.id} />
                        <input type="hidden" name="active" value={String(s.active)} />
                        <button type="submit" className="btn btn-ghost">
                          <Power size={11} strokeWidth={2} />
                          {s.active ? "Disable" : "Enable"}
                        </button>
                      </form>
                      <form action={deleteServiceAction}>
                        <input type="hidden" name="id" value={s.id} />
                        <button type="submit" className="btn btn-ghost">
                          <Trash2 size={11} strokeWidth={2} />
                          Remove
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

      <Panel code="HOW MATCHING WORKS" title="Rules applied to every source row">
        <div className="grid gap-px md:grid-cols-2">
          {[
            [
              "SERVICE PARTNER",
              "Trimmed and lower-cased, then matched against the Partner Register by official name or partner code. Exactly one match is required.",
            ],
            [
              "SERVICE ID",
              "Matched against this register first, then SERVICE NAME as a fallback. A service resolves to precisely one partner.",
            ],
            [
              "Ambiguity",
              "If a value could belong to more than one partner or service, the row is flagged and excluded. The system never guesses.",
            ],
            [
              "Extensibility",
              "Add a new Service ID here at any time, then run “Re-run matching” to re-evaluate every stored row against the updated register.",
            ],
          ].map(([t, b]) => (
            <div key={t} className="border border-rule bg-charcoal-900 p-5">
              <Silk className="text-amber-dark">{t}</Silk>
              <p className="mt-3 text-[11.5px] leading-[1.85] text-slate-warm">{b}</p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
