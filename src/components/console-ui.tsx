import Link from "next/link";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  XCircle,
  Download,
} from "lucide-react";

export function Silk({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`silk-sm ${className}`}>{children}</div>;
}

export function PageHead({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-6 border-b border-rule pb-8">
      <div className="min-w-0">
        <Silk className="text-amber-dark">{eyebrow}</Silk>
        <h1 className="mt-3.5 text-[clamp(1.75rem,3.4vw,2.55rem)] font-extrabold leading-[1.02] tracking-[-0.03em] text-cream">
          {title}
        </h1>
        {description ? (
          <p className="mt-4 max-w-[68ch] text-[13px] leading-[1.85] text-slate-warm">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2.5">{actions}</div> : null}
    </div>
  );
}

export function Panel({
  code,
  title,
  children,
  tone = "dark",
  right,
  className = "",
}: {
  code: string;
  title: string;
  children: ReactNode;
  tone?: "dark" | "paper";
  right?: ReactNode;
  className?: string;
}) {
  const dark = tone === "dark";
  return (
    <section
      className={`${dark ? "border border-rule bg-panel" : "ledger border border-cream-rule"} ${className}`}
    >
      <header
        className={`flex flex-wrap items-center justify-between gap-3 px-5 py-4 ${
          dark ? "border-b border-rule" : "border-b border-charcoal/20"
        }`}
      >
        <div>
          <Silk className={dark ? "text-amber-dark" : "text-amber-dark"}>{code}</Silk>
          <h2
            className={`mt-1.5 text-[14.5px] font-semibold tracking-[-0.012em] ${
              dark ? "text-cream" : "text-charcoal"
            }`}
          >
            {title}
          </h2>
        </div>
        {right}
      </header>
      <div className={dark ? "p-5" : "p-0"}>{children}</div>
    </section>
  );
}

const STATUS_STYLE: Record<string, string> = {
  Unprocessed: "border-slate-warm/40 text-slate-warm",
  Processing: "border-amber/50 text-amber",
  "Ready for Review": "border-amber/50 text-amber",
  "Ready to Send": "border-amber/50 text-amber",
  Sending: "border-amber/50 text-amber",
  Queued: "border-slate-warm/40 text-slate-warm",
  "Sent/Accepted": "border-teal/50 text-teal-light",
  Sent: "border-teal/50 text-teal-light",
  Failed: "border-alert/60 text-alert",
  Blocked: "border-alert/60 text-alert",
  "Partially Failed": "border-alert/60 text-alert",
  Rejected: "border-alert/60 text-alert",
  matched: "border-teal/50 text-teal-light",
  unmatched_partner: "border-alert/60 text-alert",
  unmatched_service: "border-amber/50 text-amber",
  invalid: "border-alert/60 text-alert",
  active: "border-teal/50 text-teal-light",
  inactive: "border-slate-warm/40 text-slate-warm",
};

export function StatusPill({ status, className = "" }: { status: string; className?: string }) {
  const style = STATUS_STYLE[status] ?? "border-slate-warm/40 text-slate-warm";
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-[2px] border px-2 py-[3px] silk-sm ${style} ${className}`}
    >
      <span className="h-[5px] w-[5px] rounded-full bg-current" />
      {status}
    </span>
  );
}

export function Flash({ status, msg }: { status?: string; msg?: string }) {
  if (!msg) return null;
  const map = {
    ok: { Icon: CheckCircle2, cls: "border-teal/50 bg-teal/10 text-teal-light" },
    warn: { Icon: AlertTriangle, cls: "border-amber/50 bg-amber/10 text-amber" },
    error: { Icon: XCircle, cls: "border-alert/50 bg-alert/10 text-alert" },
    info: { Icon: Info, cls: "border-slate-warm/40 bg-slate-warm/10 text-slate-warm" },
  } as const;
  const { Icon, cls } = map[(status as keyof typeof map) ?? "info"] ?? map.info;
  return (
    <div role="status" className={`flex items-start gap-3 border px-4 py-3.5 ${cls}`}>
      <Icon size={16} className="mt-[2px] shrink-0" strokeWidth={1.9} />
      <p className="text-[12.5px] leading-[1.75]">{msg}</p>
    </div>
  );
}

export function Metric({
  code,
  value,
  label,
  tone = "amber",
  sub,
}: {
  code: string;
  value: string | number;
  label: string;
  tone?: "amber" | "teal" | "alert" | "slate";
  sub?: string;
}) {
  const toneCls = {
    amber: "text-amber",
    teal: "text-teal-light",
    alert: "text-alert",
    slate: "text-slate-warm",
  }[tone];
  return (
    <div className="border border-rule bg-charcoal-900 px-5 py-5">
      <Silk className="text-slate-warm-dark">{code}</Silk>
      <div className={`num mt-3 text-[30px] leading-none font-semibold tabular-nums ${toneCls}`}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
      <div className="mt-2.5 text-[11.5px] leading-tight text-slate-warm">{label}</div>
      {sub ? <div className="mt-1.5 silk-sm text-slate-warm-dark">{sub}</div> : null}
    </div>
  );
}

export function EmptyState({
  code,
  title,
  body,
  action,
}: {
  code: string;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="dark-ink border border-dashed border-rule bg-charcoal-900/60 px-8 py-14 text-center">
      <div className="mx-auto flex h-11 w-11 items-center justify-center border border-rule">
        <span className="num text-[13px] text-amber-dark">{code}</span>
      </div>
      <h3 className="mt-5 text-[15px] font-semibold text-cream">{title}</h3>
      <p className="mx-auto mt-3 max-w-[52ch] text-[12.5px] leading-[1.85] text-slate-warm">{body}</p>
      {action ? <div className="mt-7 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function DownloadButton({
  href,
  filename,
  label = "Download",
}: {
  href: string;
  filename: string;
  label?: string;
}) {
  return (
    <a
      href={`${href}?filename=${encodeURIComponent(filename)}`}
      className="btn btn-ghost"
      style={{ borderColor: "var(--color-cream-rule)", color: "var(--color-charcoal)" }}
    >
      <Download size={12} strokeWidth={2.2} />
      {label}
    </a>
  );
}

export function LedgerTable({
  head,
  children,
  minWidth = 900,
}: {
  head: string[];
  children: ReactNode;
  minWidth?: number;
}) {
  return (
    <div className="overflow-x-auto scroll-thin">
      <table className="table-ledger" style={{ minWidth }}>
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={h} className={i > 0 && /^\d|count|revenue|total|rows/i.test(h) ? "r" : ""}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Mono({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`num ${className}`}>{children}</span>;
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="silk text-slate-warm-dark transition-colors hover:text-amber">
      ← {children}
    </Link>
  );
}

export function fmtDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (isNaN(d.getTime())) return String(value);
  return d.toISOString().slice(0, 10);
}

export function fmtDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (isNaN(d.getTime())) return String(value);
  return `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 16)}`;
}

export function money(value: string | number | null | undefined): string {
  const n = Number(value ?? 0);
  return n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
