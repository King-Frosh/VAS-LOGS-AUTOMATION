import { desc } from "drizzle-orm";
import { ScrollText, ShieldCheck } from "lucide-react";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { ensureSeeded } from "@/lib/seed";
import {
  PageHead,
  Panel,
  Flash,
  Silk,
  LedgerTable,
  EmptyState,
  Mono,
  fmtDateTime,
} from "@/components/console-ui";

export const dynamic = "force-dynamic";

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; msg?: string }>;
}) {
  await ensureSeeded();
  await requireUser();
  const sp = await searchParams;
  const rows = await db.select().from(auditLogs).orderBy(desc(auditLogs.id)).limit(250);

  return (
    <div className="space-y-9">
      <PageHead
        eyebrow="MODULE 14 · AUDIT LOGS"
        title="Administrative and system actions"
        description="Uploads, processing runs, report generation, template and SMTP configuration changes, email sends, retries and authorised resends are all recorded with the actor and timestamp. SMTP credentials are never included in these entries."
        actions={
          <div className="flex items-center gap-2.5 border border-teal/40 bg-teal/10 px-3.5 py-2">
            <ShieldCheck size={13} className="text-teal-light" strokeWidth={2} />
            <Silk className="text-teal-light">SECRETS REDACTED</Silk>
          </div>
        }
      />

      <Flash status={sp.status} msg={sp.msg} />

      <Panel code="TRAIL" title="Recorded actions" tone="paper">
        {rows.length === 0 ? (
          <div className="p-5">
            <EmptyState code="00" title="No actions recorded" body="Administrative and system activity appears here as it occurs." />
          </div>
        ) : (
          <LedgerTable head={["Timestamp", "Actor", "Role", "Action", "Entity", "Reference", "Detail"]} minWidth={1180}>
            {rows.map((a) => (
              <tr key={a.id}>
                <td>
                  <Mono className="text-[10.5px]">{fmtDateTime(a.createdAt)}</Mono>
                </td>
                <td>
                  <Mono className="text-[10.5px]">{a.actorEmail}</Mono>
                </td>
                <td>
                  <Silk className="text-slate-warm-dark">{a.actorRole.toUpperCase()}</Silk>
                </td>
                <td>
                  <span className="inline-flex items-center gap-2">
                    <ScrollText size={11} className="text-amber-dark" strokeWidth={1.9} />
                    <span className="text-[11px] font-semibold">{a.action.replace(/_/g, " ")}</span>
                  </span>
                </td>
                <td>
                  <Mono className="text-[10px] text-slate-warm-dark">{a.entity || "—"}</Mono>
                </td>
                <td>
                  <Mono className="text-[10px] text-slate-warm-dark">{a.entityId || "—"}</Mono>
                </td>
                <td>
                  <div className="max-w-[420px] text-[10.5px] leading-[1.7] text-slate-warm">
                    {a.detail || "—"}
                  </div>
                </td>
              </tr>
            ))}
          </LedgerTable>
        )}
      </Panel>
    </div>
  );
}
