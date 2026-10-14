import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";
import { Wordmark } from "@/components/Brand";
import LoginForm from "./LoginForm";

export const metadata = { title: "Sign in — BRICCS VAS Revenue Console" };

export default function LoginPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-charcoal">
      <div className="absolute inset-0">
        <img
          src="/images/rack.jpg"
          alt=""
          aria-hidden
          className="h-full w-full object-cover object-right"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-charcoal via-charcoal/94 to-charcoal/45" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-[1320px] flex-col px-6">
        <header className="flex h-[68px] items-center justify-between">
          <Link href="/">
            <Wordmark />
          </Link>
          <Link href="/" className="btn btn-ghost">
            <ArrowLeft size={13} strokeWidth={2.5} />
            Back to site
          </Link>
        </header>

        <div className="flex flex-1 items-center py-16">
          <div className="w-full max-w-[440px]">
            <div className="silk text-amber">AUTHORISED ACCESS</div>
            <h1 className="mt-5 text-[clamp(2.1rem,5vw,3.15rem)] font-extrabold leading-[0.98] tracking-[-0.032em]">
              VAS Revenue
              <span className="block text-amber">Console</span>
            </h1>
            <p className="mt-5 max-w-[42ch] text-[13.5px] leading-[1.85] text-slate-warm">
              Unreconciled log processing, partner report generation and email distribution for
              BRICCS International Ideal Limited.
            </p>

            <div className="mt-10 border border-rule bg-charcoal-900/85 p-8 backdrop-blur-sm">
              <LoginForm />
            </div>

            <div className="mt-7 flex items-start gap-3 border-l-2 border-amber/50 pl-4">
              <Lock size={14} className="mt-[3px] shrink-0 text-amber-dark" strokeWidth={1.8} />
              <p className="text-[11.5px] leading-[1.85] text-slate-warm-dark">
                Demonstration credentials — Administrator{" "}
                <span className="num text-slate-warm">admin@briccs.ng</span>, Operations{" "}
                <span className="num text-slate-warm">operations@briccs.ng</span>, Read-only{" "}
                <span className="num text-slate-warm">reviewer@briccs.ng</span>. Password for all:{" "}
                <span className="num text-slate-warm">BRICCS-Console-2026</span>. Change these
                before production use.
              </p>
            </div>
          </div>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-rule py-7">
          <div className="silk-sm text-slate-warm-dark">
            © {new Date().getFullYear()} BRICCS INTERNATIONAL IDEAL LIMITED
          </div>
          <div className="silk-sm text-slate-warm-dark">
            SMTP CREDENTIALS ARE HELD SERVER-SIDE AND NEVER RETURNED TO THE BROWSER
          </div>
        </footer>
      </div>
    </main>
  );
}
