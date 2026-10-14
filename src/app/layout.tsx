import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BRICCS International Ideal Limited — VAS Revenue Console",
  authors: [{ name: "BRICCS International Ideal Limited" }],
  description:
    "BRICCS VAS Revenue Console — automated unreconciled log processing and partner report distribution for MTN VAS value added services.",
};

const FONT_STYLESHEET =
  "https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800;900&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={FONT_STYLESHEET} />
      </head>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
