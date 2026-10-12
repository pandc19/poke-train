import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { GAMES } from "@/lib/games";
import { getLang } from "@/lib/i18n";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Poké Train",
  description: "Pokédex progress and trained roster tracker",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const lang = await getLang();
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Header
          lang={lang}
          games={GAMES.map((g) => ({
            id: g.id,
            shortName: g.shortName,
            theme: g.theme,
            breeding: g.features.breeding,
            exclusives: g.versionExclusives != null,
          }))}
        />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
