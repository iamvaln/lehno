import { Icon } from "./Icon.js";
import type { CSSProperties, HTMLAttributes, ReactElement } from "react";

export interface ProvenanceProps extends HTMLAttributes<HTMLDivElement> {
  /** D'où vient l'élément : « noté », « dit par lui », « écrit à partir de 9 notes ». */
  origin?: string;
  /** Quand : « en mars », « le 12 août ». */
  date?: string;
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
      <Icon name="corner-up-left" size={13} strokeWidth={2} aria-hidden="true" style={{ flex: "none" }} />
      <span>{parties.join(" · ")}</span>
    </div>
  );
}
