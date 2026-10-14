import { desc, eq } from "drizzle-orm";
import { RotateCw, Send, Paperclip, ChevronDown } from "lucide-react";
import { db } from "@/db";
import { emailDeliveries, emailDeliveryAttempts } from "@/db/schema";
import { requireUser, canSend } from "@/lib/auth";
import { ensureSeeded } from "@/lib/seed";
import { retryDeliveryAction, resendDeliveryAction } from "../actions";
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
} from "@/components/console-ui";

export const dynamic = "force-dynamic";

export default async function DeliveryPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; msg?: string }>;
}) {
  await ensureSeeded();
  const user = await requireUser();
  const sp = await searchParams;

  const deliveries = await db.select().from(emailDeliveries).orderBy(desc(emailDeliveries.id)).limit(200);
  const attempts = await db.select().from(emailDeliveryAttempts).orderBy(emailDeliveryAttempts.attemptNo);
  const byDelivery = new Map<number, typeof attempts>();
  for (const a of attempts) {
    byDelivery.set(a.deliveryId, [...(byDelivery.get(a.deliveryId) ?? []), a]);
  }

  const sent = deliveries.filter((d) => d.status === "Sent/Accepted").length;
  const failed = deliveries.filter((d) => d.status === "Failed" || d.status === "Blocked").length;

  return (
    <div className="space-y-9">
      <PageHead
        eyebrow="MODULE 09 · DELIVERY HISTORY"
        title="Every send attempt, recorded"
        description="Recipient, subject and attachment are snapshotted at the moment of sending so historical records are never altered by later template or register edits. Retries extend the same delivery; an authorised resend is always recorded as a separate action."
        actions={
          <div className="flex flex-wrap gap-2">
            <div className="border border-teal/40 bg-teal/10 px-3.5 py-2">
              <Silk className="text-teal-light">ACCEPTED · {sent}</Silk>
            </div>
            <div className="border border-alert/40 bg-alert/10 px-3.5 py-2">
              <Silk className="text-alert">FAILED / BLOCKED · {failed}</Silk>
            </div>
          </div>
        }
      />

      <Flash status={sp.status} msg={sp.msg} />

      <div className="flex items-start gap-3 border border-rule bg-panel px-5 py-4">
        <Send size={16} className="mt-[2px] shrink-0 text-amber" strokeWidth={1.8} />
        <p className="text-[11.5px] leading-[1.85] text-slate-warm">
          <strong className="font-semibold text-cream">Sent/Accepted</strong> means the SMTP server
          accepted the message. It does not establish that the message reached the recipient&apos;s
          inbox — where a provider supplies a delivery confirmation it is appended to the attempt
          record below.
        </p>
      </div>

      <Panel code="DELIVERY REGISTER" title="Outbound messages" tone="paper">
        {deliveries.length === 0 ? (
          <div className="p-5">
            <EmptyState
              code="00"
              title="No email dispatched yet"
              body="Send a report from the Email Centre and every attempt will appear here with its SMTP response and retry history."
            />
          </div>
        ) : (
          <LedgerTable
            head={["Delivery", "Partner", "Service", "Recipient", "Attachment", "Mode", "Attempts", "Status", "Response / error", "Action"]}
            minWidth={1520}
          >
            {deliveries.map((d) => {
              const hist = byDelivery.get(d.id) ?? [];
              return (
                <tr key={d.id}>
                  <td>
                    <Mono className="text-[11px] font-semibold">#{String(d.id).padStart(5, "0")}</Mono>
                    <div className="mt-1 text-[10px] text-slate-warm-dark">{fmtDateTime(d.createdAt)}</div>
                    <Mono className="mt-1 block text-[8.5px] text-slate-warm-dark">
                      {d.idempotencyKey.slice(0, 22)}…
                    </Mono>
                  </td>
                  <td>
                    <div className="text-[11.5px] font-semibold">{d.partnerName}</div>
                  </td>
                  <td>
                    <Mono className="text-[10.5px] text-amber-dark">{d.serviceName}</Mono>
                  </td>
                  <td>
                    <Mono className="text-[10px]">{d.toEmail}</Mono>
                    {d.ccEmails ? (
                      <div className="mt-1 text-[9px] text-slate-warm-dark">cc {d.ccEmails}</div>
                    ) : null}
                  </td>
                  <td>
                    <div className="flex items-start gap-1.5">
                      <Paperclip size={9} className="mt-[3px] shrink-0 text-slate-warm-dark" strokeWidth={2} />
                      <Mono className="max-w-[210px] truncate text-[9px]">{d.attachmentFilename}</Mono>
                    </div>
                    <div className="mt-1 text-[9px] text-slate-warm-dark">
                      {(d.attachmentBytes / 1024).toFixed(1)} KB
                    </div>
                  </td>
                  <td>
                    <Silk className="text-slate-warm-dark">{d.mode.toUpperCase()}</Silk>
                  </td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      <ChevronDown size={10} className="text-slate-warm-dark" strokeWidth={2} />
                      <Mono className="text-[11px]">{d.attempts}</Mono>
                    </div>
                    {hist.length ? (
                      <ul className="mt-1.5 space-y-1">
                        {hist.slice(0, 3).map((a) => (
                          <li key={a.id} className="text-[8.5px] leading-tight text-slate-warm-dark">
                            #{a.attemptNo} {a.status} · {fmtDateTime(a.createdAt)}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </td>
                  <td>
                    <StatusPill status={d.status} />
                    {d.sentAt ? (
                      <div className="mt-1.5 text-[9px] text-slate-warm-dark">{fmtDateTime(d.sentAt)}</div>
                    ) : null}
                  </td>
                  <td>
                    <div className="max-w-[260px] text-[9.5px] leading-[1.65] text-slate-warm-dark">
                      {d.errorMessage || d.providerResponse || "—"}
                    </div>
                  </td>
                  <td>
                    {canSend(user) ? (
                      <div className="flex flex-wrap gap-2">
                        {d.status === "Sent/Accepted" ? (
                          <form action={resendDeliveryAction}>
                            <input type="hidden" name="id" value={d.id} />
                            <button type="submit" className="btn btn-ghost">
                              <Send size={10} strokeWidth={2} />
                              Resend
                            </button>
                          </form>
                        ) : (
                          <form action={retryDeliveryAction}>
                            <input type="hidden" name="id" value={d.id} />
                            <button type="submit" className="btn btn-amber">
                              <RotateCw size={10} strokeWidth={2} />
                              Retry
                            </button>
                          </form>
                        )}
                      </div>
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
