import { Clock, Play, AlertTriangle, CheckCircle2 } from "lucide-react";
import { requireUser, canManage } from "@/lib/auth";
import { ensureSeeded } from "@/lib/seed";
import { db } from "@/db";
import { automationSettings, partners } from "@/db/schema";
import { getSmtpConfig } from "@/lib/mailer";
import { saveAutomationAction, runAutomationNowAction } from "../../actions";
import {
  PageHead,
  Panel,
  Flash,
  Silk,
  StatusPill,
  LedgerTable,
  fmtDateTime,
} from "@/components/console-ui";

export const dynamic = "force-dynamic";

const FREQUENCY_WINDOW: Record<string, string> = {
  daily: "Each run covers the configured lookback window ending today.",
  weekly: "Each run covers the trailing seven days ending today.",
  monthly: "Each run covers the trailing calendar month.",
};

export default async function AutomationPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; msg?: string }>;
}) {
  await ensureSeeded();
  const user = await requireUser();
  const sp = await searchParams;
  const [auto] = await db.select().from(automationSettings).limit(1);
  const cfg = await getSmtpConfig();
  const partnerRows = await db.select().from(partners);
  const eligible = partnerRows.filter((p) => p.active && p.autoDelivery && p.primaryEmail);
  const readOnly = !canManage(user);

  return (
    <div className="space-y-9">
      <PageHead
        eyebrow="MODULE 13 · AUTOMATION SETTINGS"
        title="Scheduled distribution"
        description="Automation processes eligible logs, generates workbooks and distributes them according to the schedule and each partner's automatic-delivery preference. It remains disabled until SMTP is configured and tested, the sender address is confirmed, and report generation has been validated."
        actions={
          <div
            className={`border px-3.5 py-2 ${
              auto?.enabled ? "border-teal/40 bg-teal/10" : "border-amber/40 bg-amber/10"
            }`}
          >
            <Silk className={auto?.enabled ? "text-teal-light" : "text-amber"}>
              {auto?.enabled ? "AUTOMATION ENABLED" : "AUTOMATION DISABLED"}
            </Silk>
          </div>
        }
      />

      <Flash status={sp.status} msg={sp.msg} />

      {!cfg.configured ? (
        <div className="flex items-start gap-3 border border-alert/50 bg-alert/10 px-5 py-4">
          <AlertTriangle size={16} className="mt-[2px] shrink-0 text-alert" strokeWidth={1.9} />
          <p className="text-[11.5px] leading-[1.8] text-alert">
            Automatic sending cannot be enabled while SMTP is incomplete. Missing:{" "}
            {cfg.missing.join(", ")}. Complete Email Settings and run both test functions first.
          </p>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,6fr)_minmax(0,6fr)]">
        <Panel code="SCHEDULE" title="Run configuration">
          <form action={saveAutomationAction} className="space-y-5">
            <label className="flex cursor-pointer items-start gap-3 border border-rule bg-charcoal-900 p-4">
              <input
                type="checkbox"
                name="enabled"
                defaultChecked={auto?.enabled ?? false}
                disabled={readOnly || !cfg.configured}
                className="mt-[3px] h-4 w-4 shrink-0 accent-[#FFB000]"
              />
              <span>
                <span className="block text-[12px] font-semibold text-cream">
                  Enable automatic daily distribution
                </span>
                <span className="mt-1.5 block text-[11px] leading-[1.75] text-slate-warm">
                  Only partners with automatic delivery enabled will receive mail. Overlapping
                  scheduled jobs cannot send the same report twice — each job is keyed to a unique
                  idempotency identifier.
                </span>
              </span>
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="frequency" className="silk-sm text-slate-warm-dark">
                  FREQUENCY
                </label>
                <select
                  id="frequency"
                  name="frequency"
                  defaultValue={auto?.frequency ?? "daily"}
                  disabled={readOnly}
                  className="field field-dark mt-2.5"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div>
                <label htmlFor="timeOfDay" className="silk-sm text-slate-warm-dark">
                  RUN TIME
                </label>
                <input
                  id="timeOfDay"
                  name="timeOfDay"
                  type="time"
                  defaultValue={auto?.timeOfDay ?? "07:30"}
                  disabled={readOnly}
                  className="field field-dark mt-2.5"
                />
              </div>
              <div>
                <label htmlFor="timezone" className="silk-sm text-slate-warm-dark">
                  TIMEZONE
                </label>
                <input
                  id="timezone"
                  name="timezone"
                  defaultValue={auto?.timezone ?? "Africa/Lagos"}
                  disabled={readOnly}
                  className="field field-dark mt-2.5"
                />
              </div>
              <div>
                <label htmlFor="lookbackDays" className="silk-sm text-slate-warm-dark">
                  REPORTING LOOKBACK · DAYS
                </label>
                <input
                  id="lookbackDays"
                  name="lookbackDays"
                  type="number"
                  min={1}
                  defaultValue={auto?.lookbackDays ?? 1}
                  disabled={readOnly}
                  className="field field-dark mt-2.5"
                />
                <p className="mt-2 text-[10px] leading-[1.7] text-slate-warm-dark">
                  The reporting period is configurable — the system does not assume a run always
                  covers the previous calendar day.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button type="submit" className="btn btn-amber" disabled={readOnly}>
                <Clock size={13} strokeWidth={2.2} />
                Save schedule
              </button>
            </div>
          </form>

          {/* Sibling form, never nested — a <form> inside a <form> is invalid HTML
              and breaks React hydration for the whole page. */}
          <div className="mt-5 border-t border-rule pt-5">
            <form action={runAutomationNowAction}>
              <button
                type="submit"
                className="btn btn-ghost"
                disabled={readOnly || !cfg.configured}
              >
                <Play size={13} strokeWidth={2.2} />
                Run automation now
              </button>
              <p className="mt-3 text-[10.5px] leading-[1.8] text-slate-warm">
                Runs the configured reporting window immediately and distributes to partners with
                automatic delivery enabled. Report generation and sending execute on the server —
                the window can be closed while it completes.
              </p>
            </form>
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel code="STATE" title="Scheduler status">
            <div className="space-y-px">
              {[
                ["Schedule", `${auto?.frequency ?? "daily"} at ${auto?.timeOfDay ?? "07:30"} ${auto?.timezone ?? "Africa/Lagos"}`],
                ["Reporting window", FREQUENCY_WINDOW[auto?.frequency ?? "daily"]],
                ["Last run", auto?.lastRunAt ? fmtDateTime(auto.lastRunAt) : "Never run"],
                ["Last result", auto?.lastRunStatus ?? "Never run"],
                ["Next scheduled run", auto?.nextRunAt ? fmtDateTime(auto.nextRunAt) : "Not scheduled"],
                ["Eligible partners", `${eligible.length} of ${partnerRows.length} registered partners`],
              ].map(([k, v]) => (
                <div key={k} className="flex flex-wrap items-baseline justify-between gap-3 border-b border-rule py-3 last:border-0">
                  <Silk className="text-slate-warm-dark">{String(k).toUpperCase()}</Silk>
                  <span className="num text-[11px] text-cream">{v}</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel code="IDEMPOTENCY" title="Duplicate-send prevention">
            <ul className="space-y-px">
              {[
                ["Unique job identifier", "Every report and email job carries a unique key derived from the run, partner and service."],
                ["Idempotency on send", "A key already accepted by the SMTP server is skipped rather than re-sent."],
                ["Retry policy", "A retry extends the existing delivery record and is never treated as a new message."],
                ["Explicit resends", "Only an authorised resend creates a fresh delivery, recorded as its own action."],
                ["Overlap protection", "A second scheduled job cannot distribute the same report unintentionally."],
              ].map(([t, b]) => (
                <li key={t} className="flex gap-3 border-b border-rule py-3.5 last:border-0">
                  <CheckCircle2 size={12} className="mt-[3px] shrink-0 text-teal-light" strokeWidth={2} />
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

      <Panel code="ELIGIBILITY" title="Partners included in automatic runs" tone="paper">
        <LedgerTable
          head={["Partner", "Code", "Primary recipient", "Cadence", "Automation", "Status"]}
          minWidth={900}
        >
          {partnerRows.map((p) => (
            <tr key={p.id}>
              <td className="text-[12px] font-semibold">{p.name}</td>
              <td>
                <span className="num text-[11px]">{p.code}</span>
              </td>
              <td>
                <span className="num text-[10.5px]">{p.primaryEmail}</span>
              </td>
              <td className="text-[10.5px] uppercase tracking-[0.12em]">{p.frequency}</td>
              <td>
                {p.autoDelivery ? (
                  <Silk className="text-teal-light">INCLUDED</Silk>
                ) : (
                  <Silk className="text-slate-warm-dark">EXCLUDED</Silk>
                )}
              </td>
              <td>
                <StatusPill status={p.active ? "active" : "inactive"} />
              </td>
            </tr>
          ))}
        </LedgerTable>
      </Panel>
    </div>
  );
}
