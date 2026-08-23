import type { CSSProperties, HTMLAttributes, ReactElement } from "react";

// Les trois paliers du contrat : 20 px en ligne de liste, 34 px en carte,
// 76 px en vue d'échéance (voir components/content/Countdown.d.ts du paquet
// de passation). Une taille de police n'est pas une propriété surveillée par
// la règle d'adhérence — seules les couleurs, ombres, durées et rayons le
// sont — mais elle reste un nombre nu faute de jeton d'affichage à ce palier.
const TAILLES: Record<"s" | "m" | "l", number> = { s: 20, m: 34, l: 76 };

export interface CountdownProps extends HTMLAttributes<HTMLSpanElement> {
  /** Jours restants avant l'échéance. 0 bascule sur la pastille « aujourd'hui ». */
  days: number;
  /** fr rend « J−3 » ; en rend « 3 days » — « jour J » n'a pas d'équivalent anglais. */
  locale?: "fr" | "en";
  /** s en ligne de liste, m en carte, l en vue d'échéance. */
  size?: "s" | "m" | "l";
  /** Force l'état du jour même, indépendamment de `days`. */
  today?: boolean;
}

// Le décompte, signature visuelle de Lehno : composé dans la police de titre,
// il devient un objet plutôt qu'une donnée. Au jour même, il cède la place à
// une pastille en abricot — le seul moment heureux du composant.
export function Countdown(
  { days, locale = "fr", size = "m", today, style, ...rest }: CountdownProps,
): ReactElement {
  const estAujourdhui = today ?? days === 0;
  const taille = TAILLES[size];

  if (estAujourdhui) {
    const libelle = locale === "fr" ? "aujourd'hui" : "today";
    const stylePastille: CSSProperties = {
      display: "inline-flex",
      alignItems: "center",
      fontFamily: "var(--font-body)",
      fontWeight: "var(--font-body-semibold)",
      fontSize: "var(--text-body-s)",
      background: "var(--celebrate)",
      color: "var(--on-celebrate)",
      padding: "var(--space-6) var(--space-12)",
      borderRadius: "var(--radius-pill)",
      ...style,
    };
    return (
      <span style={stylePastille} {...rest}>
        {libelle}
      </span>
    );
  }

  const libelle = locale === "fr" ? `J−${days}` : `${days} day${days === 1 ? "" : "s"}`;
  const styleDecompte: CSSProperties = {
    fontFamily: "var(--font-display)",
    fontVariationSettings: "var(--font-display-settings)",
    fontWeight: "var(--font-display-regular)",
    fontSize: taille,
    lineHeight: "var(--leading-display)",
    letterSpacing: "var(--tracking-display)",
    color: "var(--text-accent)",
    whiteSpace: "nowrap",
    ...style,
  };

  return (
    <span style={styleDecompte} {...rest}>
      {libelle}
    </span>
  );
}
