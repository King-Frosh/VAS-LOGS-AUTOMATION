"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";

export type Stage = {
  label: string;
  code: string;
  value: number;
  unit?: string;
  tone?: "amber" | "teal" | "alert" | "slate";
};

function Counter({ target, active, reduced }: { target: number; active: boolean; reduced: boolean }) {
  const [n, setN] = useState(reduced ? target : 0);
  useEffect(() => {
    if (!active) return;
    if (reduced) {
      setN(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const dur = 700;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, target, reduced]);
  return <span>{n.toLocaleString()}</span>;
}

const TONE: Record<string, string> = {
  amber: "#FFB000",
  teal: "#2E8B84",
  alert: "#D24B32",
  slate: "#8C949C",
};

/**
 * The console's status ribbon. Each stage lights up left→right like a
 * hardware self-test as the band scrolls into view.
 */
export default function ProcessingStrip({
  stages,
  dark = true,
}: {
  stages: Stage[];
  dark?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const reduced = useReducedMotion() ?? false;

  return (
    <div
      ref={ref}
      className={`grid w-full ${
        dark ? "bg-charcoal-900 border border-rule" : "bg-[#fffdf8] border border-cream-rule"
      }`}
      style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(0, 1fr))` }}
    >
      {stages.map((s, i) => {
        const tone = TONE[s.tone ?? "amber"];
        return (
          <motion.div
            key={s.label}
            initial={reduced ? false : { opacity: 0, y: 10 }}
            animate={inView ? { opacity: 1, y: 0 } : undefined}
            transition={{ delay: reduced ? 0 : i * 0.09, duration: 0.4, ease: [0.2, 0.7, 0.3, 1] }}
            className={`relative px-4 py-5 sm:px-5 sm:py-6 ${
              i > 0 ? (dark ? "border-l border-rule" : "border-l border-cream-rule") : ""
            }`}
          >
            {/* LED */}
            <motion.span
              initial={reduced ? false : { opacity: 0.12, scale: 0.6 }}
              animate={inView ? { opacity: 1, scale: 1 } : undefined}
              transition={{ delay: reduced ? 0 : i * 0.09 + 0.12, duration: 0.35 }}
              className="block h-[7px] w-[7px] rounded-full"
              style={{ background: tone, boxShadow: `0 0 10px ${tone}, 0 0 3px ${tone}` }}
            />
            <div className={`silk-sm mt-3 ${dark ? "text-slate-warm" : "text-slate-warm-dark"}`}>
              {s.code}
            </div>
            <div
              className={`num mt-2 text-[26px] sm:text-[30px] leading-none font-semibold tabular-nums ${
                dark ? "text-cream" : "text-charcoal"
              }`}
            >
              <Counter target={s.value} active={inView} reduced={reduced} />
              {s.unit ? (
                <span className={`ml-1 text-[11px] ${dark ? "text-slate-warm" : "text-slate-warm-dark"}`}>
                  {s.unit}
                </span>
              ) : null}
            </div>
            <div
              className={`mt-2 text-[11px] leading-tight font-medium ${
                dark ? "text-slate-warm" : "text-slate-warm-dark"
              }`}
            >
              {s.label}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
