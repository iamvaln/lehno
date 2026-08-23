import type { CSSProperties, HTMLAttributes, ReactElement, ReactNode } from "react";

export interface QuoteProps extends Omit<HTMLAttributes<HTMLParagraphElement>, "children"> {
  /** Ce que quelqu'un a dit ou écrit. */
  children: ReactNode;
  /** Force ou retire les guillemets, indépendamment de la longueur. */
  guillemets?: boolean;
  /** Taille en pixels — pas de jeton dédié à ce palier dans l'échelle d'affichage. */
  size?: number;
  tone?: "body" | "muted";
}

// Guillemets au-delà du seuil, pas avant. Choisi entre les deux exemples du
// contrat de test (25 et 84 caractères) : une citation courte n'en porte
// jamais, une citation longue toujours.
const SEUIL_GUILLEMETS = 60;

// Une parole rapportée — note, souhait, brouillon de message, phrase de
// portrait. Fraunces italique (classe .citation, base.css) : c'est la coupe
// qui distingue, pas la couleur ni la taille. Le texte de produit reste en
// Karla romain ailleurs.
export function Quote(
  { children, guillemets, size = 16, tone = "body", style, ...rest }: QuoteProps,
): ReactElement {
  const texte = typeof children === "string" ? children : "";
  const long = guillemets ?? texte.length > SEUIL_GUILLEMETS;

  const styleCitation: CSSProperties = {
    margin: 0,
    fontSize: size,
    lineHeight: "var(--leading-roomy)",
    color: tone === "muted" ? "var(--text-secondary)" : "var(--text-body)",
    ...style,
  };

  return (
    <p className="citation" style={styleCitation} {...rest}>
      {long ? "« " : ""}
      {children}
      {long ? " »" : ""}
    </p>
  );
}
