import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { GAMES } from "@/lib/games";
import { getLang, getT } from "@/lib/i18n";
import { LangProvider } from "@/lib/translate-client";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: "Poké Train",
    description: t("Pokédex progress and trained roster tracker"),
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const lang = await getLang();
  return (
    <html
      lang={lang}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <LangProvider lang={lang}>
          <Header
            games={GAMES.map((g) => ({
              id: g.id,
              shortName: g.shortName,
              theme: g.theme,
              breeding: g.features.breeding,
              exclusives: g.versionExclusives != null,
              catalog: g.catalog,
            }))}
          />
          <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
        </LangProvider>
      </body>
    </html>
  );
}
