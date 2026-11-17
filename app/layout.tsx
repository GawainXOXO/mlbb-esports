import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "MLBB Esports", template: "%s | MLBB Esports" },
  description: "Jadwal, hasil, draft, dan statistik per game esports Mobile Legends: Bang Bang.",
};

const NAV: { label: string; href?: string }[] = [
  { label: "Match", href: "/matches" },
  { label: "Hasil", href: "/matches/results" },
  { label: "Event" },
  { label: "Tim" },
  { label: "Pemain" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="min-h-screen font-sans text-[13px] antialiased">
        <header className="bg-head text-head-ink">
          <div className="mx-auto flex h-12 max-w-6xl items-center gap-6 px-4">
            <Link href="/" className="text-base font-extrabold tracking-tight text-white">
              <span className="text-accent">MLBB</span>.esports
            </Link>
            <nav aria-label="Menu utama" className="flex gap-4 font-semibold uppercase sm:gap-5">
              {NAV.map((item) =>
                item.href ? (
                  <Link key={item.label} href={item.href} className="hover:text-white">
                    {item.label}
                  </Link>
                ) : (
                  <span
                    key={item.label}
                    className="hidden cursor-default opacity-50 sm:inline"
                    title="Segera hadir"
                  >
                    {item.label}
                  </span>
                ),
              )}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-4">{children}</main>
        <footer className="mx-auto max-w-6xl px-4 pb-8 pt-4 text-xs text-muted">
          Tidak berafiliasi dengan Moonton. Mobile Legends: Bang Bang adalah merek dagang Moonton.
        </footer>
      </body>
    </html>
  );
}
