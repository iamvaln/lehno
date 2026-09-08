"use client";

import type { CSSProperties, ReactNode } from "react";
import { usePathname } from "next/navigation";
import type { Langue } from "../lib/langues.js";
import { cheminDansLautreLangue } from "../lib/chemins.js";
import type { Messages } from "../messages/index.js";

// Un lien, pas un état : changer de langue change d'adresse, donc la page se
// partage, se met en signet et s'indexe dans la langue qu'on voit. Une ancre
// ordinaire plutôt que next/link — précharger l'autre langue coûterait un
// document que presque personne n'ouvre.
//
// Texte seul, sans drapeau. Le drapeau a été retiré de la maquette v3 : un
// drapeau désigne un pays, pas une langue, et il en faudrait plusieurs pour
// chacune. Le libellé porte la langue vers laquelle on va, jamais celle qu'on
// lit.
const LIEN: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  height: "var(--space-32)",
  padding: "0 var(--space-8)",
  fontFamily: "var(--font-body)",
  fontSize: "var(--text-body-xs)",
  fontWeight: "var(--font-body-bold)",
  letterSpacing: "var(--tracking-kicker)",
  color: "var(--text-accent)",
  background: "transparent",
  border: "none",
  borderRadius: "var(--radius-xs)",
  textDecoration: "none",
};

export function BasculeLangue({ t, langue }: { t: Messages; langue: Langue }): ReactNode {
  const autre: Langue = langue === "fr" ? "en" : "fr";

  /* LE CHEMIN COURANT, PAS LA RACINE.
   *
   * Le lien pointait sur `/${autre}` : depuis la FAQ, changer de langue
   * ramenait à l'accueil, et il fallait retrouver sa page. Quelqu'un qui bascule
   * veut lire CE QU'IL LISAIT.
   *
   * `usePathname` plutôt qu'un chemin passé en propriété : ce composant vit
   * dans l'en-tête, monté une fois pour toutes les pages. Le lui faire
   * transmettre par chaque page obligerait à y penser à chaque nouvelle route —
   * et celle qu'on oublierait retomberait en silence sur l'ancien défaut. */
  const chemin = usePathname();

  return (
    <a
      href={cheminDansLautreLangue(chemin ?? `/${langue}`, langue)}
      hrefLang={autre}
      aria-label={t.langueLabel}
      title={t.langueLabel}
      className="lehno-bascule"
      style={LIEN}
    >
      {t.langueBouton}
    </a>
  );
}
