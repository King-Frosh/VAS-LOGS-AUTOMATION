import { RotateCcw, Save, Eye, Send } from "lucide-react";
import { requireUser, canManage } from "@/lib/auth";
import { ensureSeeded } from "@/lib/seed";
import { getTemplates } from "@/lib/mailer";
import { renderTemplate, PLACEHOLDERS, DEFAULT_SUBJECT } from "@/lib/templates";
import { saveTemplateAction, resetTemplateAction } from "../../actions";
import { PageHead, Panel, Flash, Silk } from "@/components/console-ui";

export const dynamic = "force-dynamic";

const SAMPLE = {
  partner_mail_address: "revenue.assurance@telewings.example",
  start_date: "2026-10-09",
  end_date: "2026-10-11",
  SERVICE_NAME: "GAMEZONE",
};

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; msg?: string }>;
}) {
  await ensureSeeded();
  const user = await requireUser();
  const sp = await searchParams;
  const templates = await getTemplates();
  const readOnly = !canManage(user);

  const previewSubject = renderTemplate(templates.subject, SAMPLE);
  const previewBody = renderTemplate(templates.body, SAMPLE);

  return (
    <div className="space-y-9">
      <PageHead
        eyebrow="MODULE 12 · EMAIL TEMPLATES"
        title="Subject and body templates"
        description="Templates apply to future sends only. Every historical delivery keeps the exact subject and body that were transmitted, so editing a template never rewrites the record of what a partner actually received."
        actions={
          <form action={resetTemplateAction}>
            <button type="submit" className="btn btn-ghost" disabled={readOnly}>
              <RotateCcw size={13} strokeWidth={2.2} />
              Restore default
            </button>
          </form>
        }
      />

      <Flash status={sp.status} msg={sp.msg} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,6fr)_minmax(0,6fr)]">
        <Panel
          code="EDITOR"
          title="Edit the saved templates"
          right={
            <Silk className={templates.isDefault ? "text-teal-light" : "text-amber"}>
              {templates.isDefault ? "DEFAULT TEMPLATE IN USE" : "CUSTOMISED"}
            </Silk>
          }
        >
          <form action={saveTemplateAction} className="space-y-5">
            <div>
              <label htmlFor="subject" className="silk-sm text-slate-warm-dark">
                SUBJECT TEMPLATE
              </label>
              <input
                id="subject"
                name="subject"
                defaultValue={templates.subject}
                disabled={readOnly}
                required
                className="field field-dark mt-2.5"
              />
              <p className="mt-2 text-[10.5px] leading-[1.7] text-slate-warm-dark">
                Saved default: <span className="num text-slate-warm">{DEFAULT_SUBJECT}</span>
              </p>
            </div>

            <div>
              <label htmlFor="body" className="silk-sm text-slate-warm-dark">
                BODY TEMPLATE
              </label>
              <textarea
                id="body"
                name="body"
                rows={14}
                defaultValue={templates.body}
                disabled={readOnly}
                required
                className="field field-dark mt-2.5 leading-[1.8]"
                style={{ resize: "vertical" }}
              />
            </div>

            <button type="submit" className="btn btn-amber" disabled={readOnly}>
              <Save size={13} strokeWidth={2.2} />
              Save templates
            </button>
          </form>
        </Panel>

        <div className="space-y-6">
          <Panel code="PREVIEW" title="Completed email with sample values">
            <div className="border border-rule bg-[#fffdf8] p-6 text-charcoal">
              <div className="border-b border-cream-rule pb-4">
                <Silk className="text-slate-warm-dark">SUBJECT</Silk>
                <div className="num mt-2 text-[12px] font-semibold leading-[1.6]">
                  {previewSubject.value}
                </div>
              </div>
              <div className="mt-4 whitespace-pre-wrap text-[12px] leading-[1.9] text-charcoal/85">
                {previewBody.value}
              </div>
              <div className="mt-5 flex items-center gap-2.5 border-t border-cream-rule pt-4">
                <Eye size={12} className="text-slate-warm-dark" strokeWidth={2} />
                <span className="silk-sm text-slate-warm-dark">
                  SAMPLE VALUES ONLY · TEST SENDS USE THE TEST ADDRESS IN EMAIL SETTINGS
                </span>
              </div>
            </div>

            {[...previewSubject.missing, ...previewBody.missing].length ? (
              <div className="mt-4 border border-alert/45 bg-alert/10 px-4 py-3">
                <p className="text-[10.5px] leading-[1.8] text-alert">
                  Unresolved placeholder(s): {[...new Set([...previewSubject.missing, ...previewBody.missing])].join(", ")}.
                  Sending is blocked while a required value cannot be resolved.
                </p>
              </div>
            ) : (
              <div className="mt-4 border border-teal/40 bg-teal/10 px-4 py-3">
                <p className="text-[10.5px] leading-[1.8] text-teal-light">
                  All required placeholders resolve correctly against the sample values.
                </p>
              </div>
            )}
          </Panel>

          <Panel code="PLACEHOLDERS" title="Supported variables">
            <ul className="space-y-px">
              {PLACEHOLDERS.map((p) => (
                <li key={p.token} className="border-b border-rule py-3.5 last:border-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="num text-[10.5px] text-amber">{p.token}</span>
                    <span className="num text-[9.5px] text-slate-warm-dark">{p.example}</span>
                  </div>
                  <p className="mt-1.5 text-[11px] leading-[1.7] text-slate-warm">{p.label}</p>
                </li>
              ))}
            </ul>
            <div className="mt-5 flex items-start gap-3 border border-rule bg-charcoal-900 px-4 py-3.5">
              <Send size={13} className="mt-[2px] shrink-0 text-amber" strokeWidth={1.8} />
              <p className="text-[10.5px] leading-[1.8] text-slate-warm">
                The service name in the subject always matches the service represented by the
                attached workbook. Where a partner has several services, each email carries its own
                service name and its own attachment.
              </p>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
