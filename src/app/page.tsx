import Link from "next/link";
import { ArrowRight, ShieldCheck, FileSpreadsheet, Send, Clock } from "lucide-react";
import { Wordmark, StageGlyph } from "@/components/Brand";
import ProcessingStrip from "@/components/ProcessingStrip";

const STAGES = [
  { code: "01 / INGEST", label: "MTN unreconciled logs accepted (.xlsx · .xls · .csv)", value: 9, unit: "cols" },
  { code: "02 / VALIDATE", label: "Source headers, dates, counts and revenue verified", value: 100, unit: "%" },
  { code: "03 / MAP", label: "Service ID → partner resolved against the mapping register", value: 12, unit: "svc" },
  { code: "04 / GENERATE", label: "One workbook per partner-service combination", value: 1, unit: "sheet" },
  { code: "05 / ATTACH", label: "Workbook validated before a send is ever permitted", value: 0, unit: "optional" },
  { code: "06 / DISTRIBUTE", label: "Daily · weekly · monthly, manual or automatic", value: 3, unit: "modes" },
];

const PIPELINE = [
  {
    glyph: 0,
    n: "01",
    title: "Upload the unreconciled log",
    body: "Drop the MTN file in its original form. BRICCS stores it privately, records its SHA-256 hash, uploader and timestamp, and warns when the same content has been uploaded before — without ever discarding it silently.",
  },
  {
    glyph: 1,
    n: "02",
    title: "Validation flags what cannot be trusted",
    body: "All nine MTN source columns are checked for presence, duplication and ambiguity. Dates, counts and revenue are parsed, and every problem is traceable back to the original source row number.",
  },
  {
    glyph: 2,
    n: "03",
    title: "Matching is explicit, never guessed",
    body: "SERVICE PARTNER is resolved against the Partner Register and SERVICE ID against the manual service mapping. An unknown or ambiguous record is held for review and excluded from partner reports until a human resolves it.",
  },
  {
    glyph: 3,
    n: "04",
    title: "One workbook per partner, per service",
    body: "A partner with three eligible services receives three separate workbooks and three separate emails. Each workbook contains exactly one worksheet named “Unreconciled Logs”, the nine original headers in their original order, and nothing else.",
  },
  {
    glyph: 4,
    n: "05",
    title: "The attachment is mandatory",
    body: "Every outgoing report email must carry its workbook. If the file is missing, unreadable, oversized or fails the single-worksheet check, the send is blocked and recorded as a failure — not quietly skipped.",
  },
];

export default function HomePage() {
  return (
    <main className="bg-charcoal text-cream">
      {/* ---------------------------------------------------------------- */}
      {/* header                                                            */}
      {/* ---------------------------------------------------------------- */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-rule/80 bg-charcoal/85 backdrop-blur-md">
        <div className="mx-auto flex h-[68px] max-w-[1320px] items-center justify-between px-6">
          <Link href="/" aria-label="BRICCS International Ideal Limited">
            <Wordmark />
          </Link>
          <nav className="hidden items-center gap-8 lg:flex">
            {[
              ["Capability", "#capability"],
              ["Deliverables", "#deliverables"],
              ["Partner view", "#partner"],
              ["Controls", "#controls"],
            ].map(([label, href]) => (
              <a
                key={href}
                href={href}
                className="silk text-slate-warm transition-colors hover:text-amber"
              >
                {label}
              </a>
            ))}
          </nav>
          <Link href="/login" className="btn btn-amber">
            Open Console
            <ArrowRight size={13} strokeWidth={2.5} />
          </Link>
        </div>
      </header>

      {/* ---------------------------------------------------------------- */}
      {/* hero                                                              */}
      {/* ---------------------------------------------------------------- */}
      <section className="relative min-h-[92vh] overflow-hidden pt-[68px]">
        <div className="absolute inset-0">
          <img
            src="/images/rack.jpg"
            alt="Telecom equipment faceplate with amber indicator lamps in a darkened operations room"
            className="h-full w-full object-cover object-right"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-charcoal via-charcoal/92 to-charcoal/25" />
          <div className="absolute inset-0 bg-gradient-to-t from-charcoal via-transparent to-charcoal/70" />
        </div>

        <div className="relative mx-auto max-w-[1320px] px-6">
          <div className="flex min-h-[calc(92vh-68px)] flex-col justify-center py-20">
            <div className="flex items-center gap-3">
              <span className="h-[7px] w-[7px] rounded-full bg-amber shadow-[0_0_12px_#FFB000]" />
              <span className="silk text-amber">
                MTN VALUE-ADDED SERVICES · REVENUE ASSURANCE
              </span>
            </div>

            <h1 className="mt-8 max-w-[16ch] text-[clamp(2.9rem,8vw,7.2rem)] font-extrabold leading-[0.88] tracking-[-0.035em]">
              Unreconciled logs,
              <span className="block text-amber">reconciled delivery.</span>
            </h1>

            <p className="mt-9 max-w-[54ch] text-[17px] leading-[1.65] text-slate-warm">
              BRICCS International Ideal Limited processes MTN unreconciled VAS transaction
              logs and distributes an accurate, service-specific Excel workbook to every
              partner — daily, weekly or monthly, sent automatically or on demand.
            </p>

            <div className="mt-11 flex flex-wrap items-center gap-3">
              <Link href="/login" className="btn btn-amber px-6 py-3.5 text-[12px]">
                Access the Revenue Console
                <ArrowRight size={14} strokeWidth={2.5} />
              </Link>
              <a href="#capability" className="btn btn-ghost px-6 py-3.5 text-[12px]">
                See the processing chain
              </a>
            </div>

            <dl className="mt-16 grid max-w-[720px] grid-cols-2 gap-x-10 gap-y-7 sm:grid-cols-4">
              {[
                ["Worksheet", "Unreconciled Logs"],
                ["Source columns", "9 required"],
                ["Send modes", "Manual · Bulk · Auto"],
                ["Timezone", "Africa/Lagos"],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="silk-sm text-slate-warm-dark">{k}</dt>
                  <dd className="num mt-2 text-[13px] font-medium text-cream">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* the status ribbon — the console's self-test                        */}
      {/* ---------------------------------------------------------------- */}
      <section className="border-y border-rule bg-charcoal-900 py-14">
        <div className="mx-auto max-w-[1320px] px-6">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <div className="silk text-amber-dark">THE PROCESSING CHAIN</div>
              <h2 className="mt-4 max-w-[22ch] text-[clamp(1.6rem,3.4vw,2.55rem)] font-extrabold leading-[1.02] tracking-[-0.025em]">
                Six stages, each one instrumented and recorded.
              </h2>
            </div>
            <p className="max-w-[38ch] text-[13.5px] leading-relaxed text-slate-warm">
              Nothing reaches a partner inbox that has not passed every stage. Each stage writes
              to the audit trail with the operator, the timestamp and the exact workbook sent.
            </p>
          </div>

          <div className="mt-9 overflow-x-auto scroll-thin">
            <div className="min-w-[860px]">
              <ProcessingStrip stages={STAGES} />
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* capability — ledger paper plane                                    */}
      {/* ---------------------------------------------------------------- */}
      <section id="capability" className="ledger py-24">
        <div className="mx-auto max-w-[1320px] px-6">
          <div className="grid gap-14 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
            <div>
              <div className="silk text-amber-dark">CAPABILITY</div>
              <h2 className="mt-5 text-[clamp(2.1rem,5vw,3.9rem)] font-extrabold leading-[0.96] tracking-[-0.032em] text-charcoal">
                From a raw MTN export to a partner&apos;s inbox,
                <span className="text-amber-dark"> without a manual step in between.</span>
              </h2>
              <p className="mt-7 max-w-[58ch] text-[15.5px] leading-[1.75] text-slate-warm-dark">
                The BRICCS VAS Revenue Console replaces the monthly spreadsheet scramble with a
                single, auditable pipeline. Reports are labelled for what they are —
                <strong className="font-semibold text-charcoal"> unreconciled logs</strong>, not
                final reconciled revenue — and the originals are preserved byte-for-byte alongside
                every workbook the system produces.
              </p>
            </div>

            <div className="self-end">
              <div className="border-l-2 border-amber pl-6">
                <div className="silk text-slate-warm-dark">THE ONE RULE</div>
                <p className="mt-4 text-[17px] font-medium leading-[1.55] text-charcoal">
                  Every outgoing partner email contains the correct service-specific Excel
                  workbook. If it cannot be attached, the email is not sent.
                </p>
              </div>
            </div>
          </div>

          <ol className="mt-16 border-t border-charcoal/25">
            {PIPELINE.map((step) => (
              <li
                key={step.n}
                className="group grid gap-6 border-b border-cream-rule py-9 md:grid-cols-[64px_minmax(0,4fr)_minmax(0,7fr)_48px] md:items-start"
              >
                <div className="flex items-center gap-3">
                  <StageGlyph stage={step.glyph} className="h-6 w-6 text-amber-dark" />
                </div>
                <div>
                  <div className="num text-[11px] tracking-[0.22em] text-slate-warm-dark">{step.n}</div>
                  <h3 className="mt-2 text-[19px] font-semibold leading-[1.25] tracking-[-0.012em] text-charcoal">
                    {step.title}
                  </h3>
                </div>
                <p className="max-w-[62ch] text-[14.5px] leading-[1.8] text-slate-warm-dark">
                  {step.body}
                </p>
                <div className="hidden justify-end md:flex">
                  <span className="num text-[10px] tracking-[0.2em] text-cream-rule transition-colors group-hover:text-amber-dark">
                    →
                  </span>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* deliverables                                                       */}
      {/* ---------------------------------------------------------------- */}
      <section id="deliverables" className="relative overflow-hidden bg-charcoal py-24">
        <div className="absolute inset-y-0 right-0 hidden w-[46%] lg:block">
          <img
            src="/images/report-desk.jpg"
            alt="A printed reconciliation report clipped to a dark desk under warm lamp light"
            className="h-full w-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-charcoal via-charcoal/45 to-transparent" />
          <div className="absolute inset-0 bg-charcoal/25" />
        </div>

        <div className="relative mx-auto max-w-[1320px] px-6">
          <div className="max-w-[640px]">
            <div className="silk text-amber">DELIVERABLES</div>
            <h2 className="mt-5 text-[clamp(2.1rem,5vw,3.6rem)] font-extrabold leading-[0.98] tracking-[-0.03em]">
              What lands in your inbox.
            </h2>

            <div className="mt-10 space-y-px">
              {[
                {
                  icon: FileSpreadsheet,
                  title: "One workbook per partner, per service",
                  body: "BRICCS_VAS_Report_[PartnerCode]_[SERVICE_NAME]_[Start]_[End].xlsx — a single worksheet named Unreconciled Logs, the nine MTN headers in their original order, identifiers held as text so leading zeroes survive.",
                },
                {
                  icon: Send,
                  title: "One email per workbook",
                  body: "A partner with three eligible services receives three emails, each carrying only its own service's records for the selected inclusive reporting period.",
                },
                {
                  icon: Clock,
                  title: "On your cadence",
                  body: "Daily, weekly or monthly schedules run in Africa/Lagos, with per-partner automatic delivery you can switch on or off at any time.",
                },
                {
                  icon: ShieldCheck,
                  title: "A complete audit trail",
                  body: "Every upload, processing run, generation, send attempt, failure and explicit resend is recorded with the actor and timestamp. SMTP credentials never leave the server.",
                },
              ].map(({ icon: Icon, title, body }) => (
                <div key={title} className="border-t border-rule py-7">
                  <div className="flex items-start gap-4">
                    <Icon size={19} className="mt-[3px] shrink-0 text-amber" strokeWidth={1.7} />
                    <div>
                      <h3 className="text-[17px] font-semibold tracking-[-0.012em]">{title}</h3>
                      <p className="mt-2.5 max-w-[54ch] text-[13.5px] leading-[1.8] text-slate-warm">
                        {body}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* partner view                                                       */}
      {/* ---------------------------------------------------------------- */}
      <section id="partner" className="ledger py-24">
        <div className="mx-auto max-w-[1320px] px-6">
          <div className="grid gap-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            <div>
              <div className="silk text-amber-dark">PARTNER VIEW</div>
              <h2 className="mt-5 text-[clamp(1.95rem,4.2vw,3.15rem)] font-extrabold leading-[1] tracking-[-0.03em] text-charcoal">
                The email your team receives, exactly as it is sent.
              </h2>
              <p className="mt-7 max-w-[46ch] text-[14.5px] leading-[1.8] text-slate-warm-dark">
                Subject and body templates are editable by an authorised administrator, and every
                placeholder is resolved against the Partner Register before transmission. If a
                required value is missing, the send is blocked with an actionable error rather
                than delivered half-complete.
              </p>
              <Link href="/login" className="btn btn-dark mt-9">
                Sign in to review delivery history
                <ArrowRight size={13} strokeWidth={2.5} />
              </Link>
            </div>

            {/* the email specimen, rendered as a real paper card */}
            <div className="relative">
              <div className="absolute -left-3 -top-3 h-full w-full border border-charcoal/15" />
              <div className="relative bg-[#fffdf8] p-8 shadow-[0_24px_60px_-28px_rgba(18,22,26,0.55)] sm:p-10">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cream-rule pb-5">
                  <div>
                    <div className="silk-sm text-slate-warm-dark">SUBJECT</div>
                    <div className="num mt-2 text-[13.5px] font-semibold text-charcoal">
                      DAILY UNRECONCILED LOG 2026 - GAMEZONE
                    </div>
                  </div>
                  <div className="rounded-[2px] border border-teal/40 bg-teal/10 px-2.5 py-1.5">
                    <span className="silk-sm text-teal">ATTACHMENT VERIFIED</span>
                  </div>
                </div>

                <div className="mt-6 space-y-3 text-[13.5px] leading-[1.9] text-charcoal/85">
                  <p>Dear revenue.assurance@telewings.example,</p>
                  <p>We hope this mail finds you well.</p>
                  <p>
                    Kindly find attached the UNRECONCILED LOGS for your service from{" "}
                    <span className="num bg-amber/20 px-1.5 py-0.5 text-charcoal">2026-10-09</span>{" "}
                    to{" "}
                    <span className="num bg-amber/20 px-1.5 py-0.5 text-charcoal">2026-10-11</span>.
                  </p>
                  <p>Thank you.</p>
                  <p className="text-slate-warm-dark">— — —</p>
                  <p>Best Regards.</p>
                </div>

                <div className="mt-8 flex flex-wrap items-center gap-4 border-t border-cream-rule pt-6">
                  <div className="flex h-11 w-11 items-center justify-center border border-charcoal/20 bg-cream-2">
                    <FileSpreadsheet size={19} className="text-charcoal" strokeWidth={1.6} />
                  </div>
                  <div>
                    <div className="num text-[11.5px] font-semibold text-charcoal">
                      BRICCS_VAS_Report_TWL_GAMEZONE_2026-10-09_2026-10-11.xlsx
                    </div>
                    <div className="silk-sm mt-1.5 text-slate-warm-dark">
                      1 SHEET · “UNRECONCILED LOGS” · 9 COLUMNS · 41.2 KB
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* controls                                                           */}
      {/* ---------------------------------------------------------------- */}
      <section id="controls" className="border-t border-rule bg-charcoal-900 py-24">
        <div className="mx-auto max-w-[1320px] px-6">
          <div className="silk text-amber-dark">GOVERNANCE</div>
          <h2 className="mt-5 max-w-[24ch] text-[clamp(1.95rem,4.2vw,3.15rem)] font-extrabold leading-[1.02] tracking-[-0.03em]">
            Built for the people who have to answer for the numbers.
          </h2>

          <div className="mt-12 grid gap-px border border-rule bg-rule md:grid-cols-3">
            {[
              {
                role: "ADMINISTRATOR",
                body: "Full control of SMTP credentials, the Partner Register, the service mapping, templates, schedules and distribution.",
              },
              {
                role: "OPERATIONS USER",
                body: "Uploads logs, runs processing, reviews validation errors and sends reports within assigned permissions.",
              },
              {
                role: "READ-ONLY REVIEWER",
                body: "Views authorised reports and delivery history. Cannot alter settings and cannot send email.",
              },
            ].map((r, i) => (
              <div
                key={r.role}
                className={`bg-charcoal-900 p-8 ${i === 0 ? "border-l-2 border-amber" : ""}`}
              >
                <div className={`silk ${i === 0 ? "text-amber" : "text-slate-warm-dark"}`}>{r.role}</div>
                <p className="mt-5 text-[13.5px] leading-[1.85] text-slate-warm">{r.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-14 grid gap-8 border-t border-rule pt-10 md:grid-cols-2 lg:grid-cols-4">
            {[
              ["Duplicate upload detection", "Content hash comparison warns before the same file is processed twice."],
              ["Reconciliation check", "Valid source totals are proven against matched and unmatched records."],
              ["Formula injection defence", "Every generated cell is sanitised before it reaches an .xlsx."],
              ["Private storage", "Originals and workbooks stay server-side. No permanent public URLs."],
            ].map(([t, b]) => (
              <div key={t}>
                <h3 className="text-[13.5px] font-semibold text-cream">{t}</h3>
                <p className="mt-2.5 text-[12.5px] leading-[1.8] text-slate-warm">{b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* cta + footer                                                       */}
      {/* ---------------------------------------------------------------- */}
      <section className="relative overflow-hidden border-y border-rule">
        <div className="absolute inset-0">
          <img src="/images/rack.jpg" alt="" aria-hidden className="h-full w-full object-cover opacity-25" />
          <div className="absolute inset-0 bg-gradient-to-r from-charcoal via-charcoal/85 to-charcoal/60" />
        </div>
        <div className="relative mx-auto max-w-[1320px] px-6 py-24">
          <h2 className="max-w-[18ch] text-[clamp(2.1rem,5.4vw,4.1rem)] font-extrabold leading-[0.95] tracking-[-0.032em]">
            Send the log. <span className="text-amber">Not the scramble.</span>
          </h2>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/login" className="btn btn-amber px-7 py-4 text-[12px]">
              Open the VAS Revenue Console
              <ArrowRight size={14} strokeWidth={2.5} />
            </Link>
            <a href="mailto:partnerships@briccs.example" className="btn btn-ghost px-7 py-4 text-[12px]">
              partnerships@briccs.example
            </a>
          </div>
        </div>
      </section>

      <footer className="bg-charcoal py-14">
        <div className="mx-auto max-w-[1320px] px-6">
          <div className="flex flex-wrap items-start justify-between gap-10">
            <div>
              <Wordmark />
              <p className="mt-6 max-w-[38ch] text-[12.5px] leading-[1.9] text-slate-warm">
                BRICCS International Ideal Limited · Value-added services revenue assurance and
                partner reconciliation reporting for the Nigerian telecom market.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-x-14 gap-y-6 sm:grid-cols-3">
              {[
                ["Console", ["Dashboard", "Upload Logs", "Generated Reports", "Email Centre"]],
                ["Registers", ["Partner Register", "Service Mapping", "Delivery History", "Audit Logs"]],
                ["Configuration", ["Email Settings", "Email Templates", "Automation", "System Settings"]],
              ].map(([head, items]) => (
                <div key={head as string}>
                  <div className="silk-sm text-slate-warm-dark">{head as string}</div>
                  <ul className="mt-4 space-y-2.5">
                    {(items as string[]).map((it) => (
                      <li key={it}>
                        <Link
                          href="/login"
                          className="text-[12.5px] text-slate-warm transition-colors hover:text-amber"
                        >
                          {it}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-rule pt-7">
            <div className="silk-sm text-slate-warm-dark">
              © {new Date().getFullYear()} BRICCS INTERNATIONAL IDEAL LIMITED
            </div>
            <div className="silk-sm text-slate-warm-dark">
              ALL REPORTS LABELLED UNRECONCILED LOGS · NOT FINAL RECONCILED REVENUE
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
