import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { prisma } from "@/lib/db";
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
  // Item names come from the game data when it has them, so what the catalog says to search
  // for is what the game really calls the item (the names written in the catalog are a fallback).
  const slugs = [...new Set(GAMES.flatMap((g) => g.catalog.flatMap((s) => s.entries.map((e) => e.sprite ?? ""))))].filter(Boolean);
  const items = await prisma.item
    .findMany({ where: { slug: { in: slugs } }, select: { slug: true, nameEn: true, nameEs: true } })
    .catch(() => []);
  const bySlug = new Map(items.map((i) => [i.slug, i]));
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
              catalog: g.catalog.map((section) => ({
                ...section,
                entries: section.entries.map((e) => {
                  const item = e.sprite ? bySlug.get(e.sprite) : undefined;
                  return item?.nameEn && item.nameEs ? { ...e, name: { en: item.nameEn, es: item.nameEs } } : e;
                }),
              })),
            }))}
          />
          <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
        </LangProvider>
      </body>
    </html>
  );
}
