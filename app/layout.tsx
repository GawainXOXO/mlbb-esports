import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "MLBB Esports", template: "%s | MLBB Esports" },
  description: "Jadwal, hasil, draft, dan statistik per game esports Mobile Legends: Bang Bang.",
};

const NAV = ["Match", "Hasil", "Event", "Tim", "Pemain"];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="min-h-screen font-sans text-[13px] antialiased">
        <header className="bg-head text-head-ink">
          <div className="mx-auto flex h-12 max-w-6xl items-center gap-6 px-4">
            <Link href="/" className="text-base font-extrabold tracking-tight text-white">
              <span className="text-accent">MLBB</span>.esports
            </Link>
            <nav aria-label="Menu utama" className="hidden gap-5 font-semibold uppercase sm:flex">
              {NAV.map((item) => (
                <span key={item} className="cursor-default opacity-60" title="Segera hadir">
                  {item}
                </span>
              ))}
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
