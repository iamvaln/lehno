import type { CSSProperties, HTMLAttributes, ReactElement } from "react";

export interface ProvenanceProps extends HTMLAttributes<HTMLDivElement> {
  /** D'où vient l'élément : « noté », « dit par lui », « écrit à partir de 9 notes ». */
  origin?: string;
  /** Quand : « en mars », « le 12 août ». */
  date?: string;
}

// La flèche de retour du contrat (13 px). Inlinée en attendant le composant
// Icon partagé, écrit par une tâche parallèle absente de ce chantier — voir
// le rapport de tâche 7. Même façon de faire que BasculeTheme.tsx : un tracé
// en currentColor, aucune couleur propre.
function FlecheRetour(): ReactElement {
  return (
    <svg
      width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      style={{ flex: "none" }}
    >
      <path d="M9 14 4 9l5-5" />
      <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
    </svg>
  );
}

// La ligne de provenance : d'où vient ce qu'on vous montre, toujours au même
// endroit — le pied de l'élément, sous un filet d'un pixel. Elle n'apparaît
// que si elle apprend quelque chose (specs/design-system-lehno.md §6.1) :
// sans origine ni date, il n'y a rien à dire, et le composant ne rend rien.
export function Provenance(
  { origin, date, style, ...rest }: ProvenanceProps,
): ReactElement | null {
  const parties = [origin, date].filter(Boolean);
  if (parties.length === 0) return null;

  const styleLigne: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "var(--space-6)",
    marginTop: "var(--space-10)",
    paddingTop: "var(--space-8)",
    borderTop: "var(--border-width) solid var(--border-hairline)",
    fontFamily: "var(--font-body)",
    fontSize: "var(--text-mention-s)",
    color: "var(--text-mention)",
    ...style,
  };

  return (
    <div style={styleLigne} {...rest}>
      <FlecheRetour />
      <span>{parties.join(" · ")}</span>
    </div>
  );
}
