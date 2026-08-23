import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { fraunces, karla } from "../../lib/fonts";
import { themeCss } from "../../lib/theme-css";
import { themeScript } from "../../lib/theme-script";
import { LANGUES, estLangue, type Langue } from "../../lib/langues";
import "../globals.css";

// La coquille racine vit sous [locale] : c'est le seul endroit d'où l'on connaît
// la langue au moment de rendre <html lang>, et une page dont la langue déclarée
// ment aux lecteurs d'écran est une page inaccessible (WCAG 3.1.1).
export function generateStaticParams(): { locale: Langue }[] {
  return LANGUES.map((locale) => ({ locale }));
}

export const metadata = {
  title: "Lehno",
  description: "Chaque date qui compte, bien célébrée.",
  icons: { icon: "/brand/lehno-favicon-28.svg" },
};

export default async function CoquilleRacine(
  { children, params }: { children: ReactNode; params: Promise<{ locale: string }> },
): Promise<ReactNode> {
  const { locale } = await params;
  if (!estLangue(locale)) notFound();

  return (
    <html lang={locale} className={`${fraunces.variable} ${karla.variable}`} suppressHydrationWarning>
      <head>
        {/* Les jetons hors thème et les variables des deux thèmes, émises depuis
            @lehno/tokens. Le thème sombre s'obtient par la classe lehno-nuit,
            portée par <body> — ou par <html> le temps que <body> existe. */}
        <style dangerouslySetInnerHTML={{ __html: themeCss }} />
        {/* Résolu avant la première peinture : sans lui, la page s'affiche en
            clair puis bascule sous les yeux du visiteur. <body> n'existe pas
            encore ici, la classe se pose donc sur <html>. */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
