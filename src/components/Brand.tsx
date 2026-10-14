export function BrandMark({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      role="img"
      aria-label="BRICCS"
    >
      <rect x="0" y="0" width="48" height="48" rx="3" fill="#FFB000" />
      {/* stacked-ribbon B — drawn as one continuous form */}
      <path
        d="M13 11h12.4c4.2 0 7 2.1 7 5.6 0 2.4-1.3 4.1-3.6 4.9v.2c2.9.6 4.6 2.5 4.6 5.3 0 3.9-3 6.4-7.7 6.4H13V11Zm5.6 4.3v4.6h5.1c1.9 0 3-1 3-2.4 0-1.4-1.1-2.2-3-2.2h-5.1Zm0 8.5v5.1h5.7c2.1 0 3.3-1 3.3-2.6 0-1.6-1.2-2.5-3.3-2.5h-5.7Z"
        fill="#12161A"
      />
      <path d="M34.6 11h2.9v22.2h-2.9V11Z" fill="#12161A" opacity="0.55" />
    </svg>
  );
}

export function Wordmark({
  className = "",
  tone = "light",
}: {
  className?: string;
  tone?: "light" | "dark";
}) {
  const primary = tone === "light" ? "text-cream" : "text-charcoal";
  const secondary = tone === "light" ? "text-slate-warm" : "text-slate-warm-dark";
  return (
    <span className={`flex items-center gap-3 ${className}`}>
      <BrandMark size={30} />
      <span className="leading-none">
        <span className={`block font-display font-extrabold tracking-[-0.02em] text-[15px] ${primary}`}>
          BRICCS
        </span>
        <span className={`block silk-sm mt-[3px] ${secondary}`}>INTERNATIONAL IDEAL</span>
      </span>
    </span>
  );
}

/** Pipeline glyph used in the capability band — hand-drawn, single colour. */
export function StageGlyph({ stage, className = "" }: { stage: number; className?: string }) {
  const paths = [
    "M2 16h20M6 8h12l-3 8H9L6 8Z", // upload
    "M4 6h16v12H4zM7 10h10M7 14h6", // validate
    "M12 3v18M4 8h16M4 16h16", // map
    "M5 3h10l4 4v14H5zM15 3v4h4", // workbook
    "M2 6h20v12H2zM2 6l10 7 10-7", // email
    "M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11ZM12 7v5", // route
    "M12 2l2.9 6.2 6.6.8-4.9 4.6 1.3 6.6-5.9-3.3-5.9 3.3 1.3-6.6L2.5 9l6.6-.8L12 2Z", // complete
  ];
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d={paths[stage % paths.length]} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
