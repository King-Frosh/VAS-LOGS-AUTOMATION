import { KeyRound, PlugZap, Send, ShieldCheck, Lock } from "lucide-react";
import { requireUser, canManage } from "@/lib/auth";
import { ensureSeeded } from "@/lib/seed";
import { getSmtpConfig, maskSecret } from "@/lib/mailer";
import {
  saveSmtpAction,
  testSmtpAction,
  sendTestEmailAction,
} from "../../actions";
import { PageHead, Panel, Flash, Silk } from "@/components/console-ui";

export const dynamic = "force-dynamic";

export default async function SmtpPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; msg?: string }>;
}) {
  await ensureSeeded();
  const user = await requireUser();
  const sp = await searchParams;
  const cfg = await getSmtpConfig();
  const readOnly = !canManage(user);

  return (
    <div className="space-y-9">
      <PageHead
        eyebrow="MODULE 11 · EMAIL SETTINGS"
        title="SMTP provider configuration"
        description="The four mandatory settings — SMTP Server, Port, Login and Password — authenticate every outbound message. The password is encrypted at rest, masked in this interface, and never written to the audit log, an API response or a delivery record."
        actions={
          <div
            className={`border px-3.5 py-2 ${
              cfg.configured ? "border-teal/40 bg-teal/10" : "border-alert/40 bg-alert/10"
            }`}
          >
            <Silk className={cfg.configured ? "text-teal-light" : "text-alert"}>
              {cfg.configured ? "CONFIGURATION COMPLETE" : `INCOMPLETE · ${cfg.missing.length} MISSING`}
            </Silk>
          </div>
        }
      />

      <Flash status={sp.status} msg={sp.msg} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <Panel
          code="CONNECTION"
          title="Provider settings"
          right={<Silk className="text-slate-warm-dark">{readOnly ? "READ ONLY" : "ADMINISTRATOR"}</Silk>}
        >
          <form action={saveSmtpAction} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="host" className="silk-sm text-slate-warm-dark">
                  SMTP SERVER · MANDATORY
                </label>
                <input
                  id="host"
                  name="host"
                  defaultValue={cfg.host}
                  placeholder="smtp.provider.example"
                  disabled={readOnly}
                  required
                  className="field field-dark mt-2.5"
                />
              </div>
              <div>
                <label htmlFor="port" className="silk-sm text-slate-warm-dark">
                  PORT · MANDATORY
                </label>
                <input
                  id="port"
                  name="port"
                  type="number"
                  defaultValue={cfg.port}
                  placeholder="587"
                  disabled={readOnly}
                  required
                  className="field field-dark mt-2.5"
                />
              </div>
              <div>
                <label htmlFor="login" className="silk-sm text-slate-warm-dark">
                  LOGIN · MANDATORY
                </label>
                <input
                  id="login"
                  name="login"
                  defaultValue={cfg.login}
                  placeholder="mailer@briccs.example"
                  disabled={readOnly}
                  required
                  className="field field-dark mt-2.5"
                />
              </div>
              <div>
                <label htmlFor="password" className="silk-sm text-slate-warm-dark">
                  PASSWORD · MANDATORY
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  placeholder={cfg.password ? maskSecret(cfg.password) : "enter to set or replace"}
                  disabled={readOnly}
                  autoComplete="new-password"
                  className="field field-dark mt-2.5"
                />
                <p className="mt-2 flex items-center gap-1.5 text-[10px] leading-[1.7] text-slate-warm-dark">
                  <Lock size={9} strokeWidth={2} />
                  {cfg.password
                    ? "A password is stored. Leave blank to keep the current credential."
                    : "No password stored yet."}
                </p>
              </div>
              <div>
                <label htmlFor="security" className="silk-sm text-slate-warm-dark">
                  SECURITY
                </label>
                <select
                  id="security"
                  name="security"
                  defaultValue={cfg.security}
                  disabled={readOnly}
                  className="field field-dark mt-2.5"
                >
                  <option value="STARTTLS">STARTTLS — typically port 587</option>
                  <option value="TLS">Implicit TLS — typically port 465</option>
                  <option value="None">None — not recommended</option>
                </select>
              </div>
              <div>
                <label htmlFor="fromName" className="silk-sm text-slate-warm-dark">
                  FROM NAME
                </label>
                <input
                  id="fromName"
                  name="fromName"
                  defaultValue={cfg.fromName}
                  disabled={readOnly}
                  className="field field-dark mt-2.5"
                />
              </div>
              <div>
                <label htmlFor="fromEmail" className="silk-sm text-slate-warm-dark">
                  FROM EMAIL · AUTHORISED SENDER
                </label>
                <input
                  id="fromEmail"
                  name="fromEmail"
                  type="email"
                  defaultValue={cfg.fromEmail}
                  placeholder="vas.reports@briccs.example"
                  disabled={readOnly}
                  className="field field-dark mt-2.5"
                />
              </div>
              <div>
                <label htmlFor="testEmail" className="silk-sm text-slate-warm-dark">
                  TEST EMAIL ADDRESS
                </label>
                <input
                  id="testEmail"
                  name="testEmail"
                  type="email"
                  defaultValue={cfg.testEmail}
                  placeholder="revenue.assurance@briccs.example"
                  disabled={readOnly}
                  className="field field-dark mt-2.5"
                />
              </div>
            </div>

            <button type="submit" className="btn btn-amber" disabled={readOnly}>
              <KeyRound size={13} strokeWidth={2.2} />
              Save SMTP settings
            </button>
          </form>
        </Panel>

        <div className="space-y-6">
          <Panel code="DIAGNOSTICS" title="Verify the provider">
            <div className="space-y-4">
              <div className="border border-rule bg-charcoal-900 p-5">
                <div className="flex items-start gap-3">
                  <PlugZap size={16} className="mt-[2px] shrink-0 text-amber" strokeWidth={1.8} />
                  <div>
                    <h3 className="text-[12.5px] font-semibold text-cream">Test SMTP connection</h3>
                    <p className="mt-2 text-[11px] leading-[1.8] text-slate-warm">
                      Confirms the required settings are present, opens a secure connection to the
                      configured server, and verifies authentication. Passwords are never echoed in
                      the result.
                    </p>
                    <form action={testSmtpAction} className="mt-4">
                      <button type="submit" className="btn btn-ghost" disabled={readOnly}>
                        <PlugZap size={12} strokeWidth={2.2} />
                        Run connection test
                      </button>
                    </form>
                  </div>
                </div>
              </div>

              <div className="border border-rule bg-charcoal-900 p-5">
                <div className="flex items-start gap-3">
                  <Send size={16} className="mt-[2px] shrink-0 text-amber" strokeWidth={1.8} />
                  <div className="w-full">
                    <h3 className="text-[12.5px] font-semibold text-cream">Send a test email</h3>
                    <p className="mt-2 text-[11px] leading-[1.8] text-slate-warm">
                      A successful connection test alone does not prove delivery. Send an actual
                      message to confirm the provider will accept and transmit mail on your behalf.
                    </p>
                    <form action={sendTestEmailAction} className="mt-4 space-y-3">
                      <input
                        name="testEmail"
                        type="email"
                        defaultValue={cfg.testEmail}
                        placeholder="recipient address"
                        disabled={readOnly}
                        className="field field-dark"
                      />
                      <button type="submit" className="btn btn-amber" disabled={readOnly}>
                        <Send size={12} strokeWidth={2.2} />
                        Send test message
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          </Panel>

          <Panel code="CREDENTIAL SECURITY" title="How secrets are handled">
            <ul className="space-y-px">
              {[
                ["Encrypted at rest", "The SMTP password is stored as an AES-256-GCM ciphertext, never in clear text."],
                ["Server-side only", "It is decrypted only inside the mail transport. No API response carries it to the browser."],
                ["Masked in the UI", "The interface shows a masked hint only, and never the value itself."],
                ["Never logged", "Audit entries record that settings changed, not the credential that changed."],
                ["TLS enforced", "STARTTLS or implicit TLS is required according to the provider's port."],
                ["Blocked sends", "If SMTP is incomplete, every send is blocked with an actionable message instead of failing silently."],
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
            <div className="mt-5 border border-amber/35 bg-amber/8 px-4 py-3.5">
              <p className="text-[10.5px] leading-[1.8] text-amber">
                If the hosting platform blocks outbound SMTP connections, the connection test will
                report the failure clearly so a supported mail relay or provider API can be
                substituted instead.
              </p>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
