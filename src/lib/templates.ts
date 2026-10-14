export const DEFAULT_SUBJECT = "DAILY UNRECONCILED LOG 2026 - {{SERVICE_NAME}}";

export const DEFAULT_BODY = `Dear {{partner_mail address}},

We hope this mail finds you well.

Kindly find attached the UNRECONCILED LOGS for your service from {{start_date}} to {{end_date}}.

Thank you.

---

Best Regards.`;

export type TemplateVars = {
  partner_mail_address: string;
  start_date: string;
  end_date: string;
  SERVICE_NAME: string;
};

export const PLACEHOLDERS: { token: string; label: string; example: string }[] = [
  {
    token: "{{partner_mail address}}",
    label: "Primary recipient from the Partner Register",
    example: "revenue@partner.example",
  },
  { token: "{{start_date}}", label: "Selected inclusive start date", example: "2026-10-09" },
  { token: "{{start_date}}".replace("start_date", "end_date"), label: "Selected inclusive end date", example: "2026-10-11" },
  { token: "{{SERVICE_NAME}}", label: "Service represented by the attached workbook", example: "GAMEZONE" },
];

/** Resolves every required placeholder. Returns an error when one cannot be resolved. */
export function renderTemplate(
  template: string,
  vars: Partial<TemplateVars>
): { value: string; missing: string[] } {
  const missing: string[] = [];
  const value = template
    .replace(/\{\{\s*partner_mail address\s*\}\}/gi, () => {
      const v = vars.partner_mail_address?.trim();
      if (!v) {
        missing.push("{{partner_mail address}}");
        return "{{partner_mail address}}";
      }
      return v;
    })
    .replace(/\{\{\s*start_date\s*\}\}/gi, () => {
      const v = vars.start_date?.trim();
      if (!v) {
        missing.push("{{start_date}}");
        return "{{start_date}}";
      }
      return v;
    })
    .replace(/\{\{\s*end_date\s*\}\}/gi, () => {
      const v = vars.end_date?.trim();
      if (!v) {
        missing.push("{{end_date}}");
        return "{{end_date}}";
      }
      return v;
    })
    .replace(/\{\{\s*SERVICE_NAME\s*\}\}/gi, () => {
      const v = vars.SERVICE_NAME?.trim();
      if (!v) {
        missing.push("{{SERVICE_NAME}}");
        return "{{SERVICE_NAME}}";
      }
      return v;
    });

  const unresolved = value.match(/\{\{[^}]*\}\}/g);
  return { value, missing: [...new Set([...missing, ...(unresolved ?? [])])] };
}
