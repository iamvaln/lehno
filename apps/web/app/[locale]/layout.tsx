import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { primitives } from "@lehno/tokens";
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

// Les icônes du favicon et le manifeste vivent à la racine de public/ (voir
// site.webmanifest, qui les y déclare) — jamais sous /brand, réservé aux
// fichiers de marque servis par BrandMark et Wordmark. Chaque chemin ci-dessous
// a été vérifié contre un fichier réellement présent dans apps/web/public/
// (task-8-brief.md : « le piège de cette tâche est le placement, pas le code »).
export const metadata: Metadata = {
  title: "Lehno",
  description: "Chaque date qui compte, bien célébrée.",
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-touch-icon-180.png" }],
    other: [
      // Onglet épinglé Safari, une seule encre. La couleur vient de la
      // primitive de jetons (valeur JS, pas une variable CSS) : c'est un
      // attribut HTML statique, résolu au rendu serveur, pas un style —
      // aucune var(--…) n'y a de prise.
      { rel: "mask-icon", url: "/safari-pinned-tab.svg", color: primitives.light.ink },
    ],
  },
};

// Le manifeste ne porte qu'une seule couleur de thème : #7B6BB7, le violet
// clair. En sombre le produit passe à #9C8BD8, mais un manifeste ne connaît
// qu'un thème — et le violet clair reste lisible sur une barre système sombre.
// Valeur laissée telle quelle (task-8-brief.md, étape 3).

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
