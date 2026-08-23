import type { CSSProperties, ReactNode } from "react";
import type { Langue } from "../lib/langues.js";
import type { Messages } from "../messages/index.js";

const LIEN: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--space-6)",
  fontFamily: "var(--font-body)",
  fontSize: "var(--text-body-xs)",
  fontWeight: "var(--font-body-semibold)",
  color: "var(--text-secondary)",
  background: "transparent",
  border: "var(--border-width) solid var(--border-object)",
  borderRadius: "var(--radius-xs)",
  padding: "0 var(--space-10)",
  height: "var(--space-32)",
};

// Une ancre ordinaire, pas next/link : changer de langue est une navigation entière,
// et précharger l'autre langue coûterait un document que presque personne n'ouvre.
// Un lien, pas un état : changer de langue change d'adresse, donc la page se
// partage, se met en signet et s'indexe dans la langue qu'on voit.
// Le drapeau est celui de la langue vers laquelle on va, jamais de celle qu'on lit.
//
// Le drapeau est un fichier statique (public/flags) plutôt qu'un tracé inline :
// ses couleurs sont fixées par deux drapeaux nationaux, hors de notre palette,
// et la règle d'adhérence refuse tout hexadécimal dans un composant — y compris
// dans un attribut fill. Un fichier de marque suit la même logique.
export function BasculeLangue({ t, langue }: { t: Messages; langue: Langue }): ReactNode {
  const autre: Langue = langue === "fr" ? "en" : "fr";
  const drapeau = autre === "en" ? "/flags/gb.svg" : "/flags/fr.svg";

  return (
    <a href={`/${autre}`} hrefLang={autre} aria-label={t.langueLabel} title={t.langueLabel} style={LIEN}>
      <img src={drapeau} alt="" aria-hidden="true" width={20} height={14} style={{ display: "block", borderRadius: 0 }} />
      {t.langueBouton}
    </a>
  );
}
