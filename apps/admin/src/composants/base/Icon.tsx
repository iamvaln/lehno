import type { ComponentType, SVGAttributes } from "react";
import { icons } from "lucide-react";

export interface IconProps extends SVGAttributes<SVGSVGElement> {
  /** Nom Lucide en kebab-case : "calendar", "chevron-right", "corner-up-left". */
  name: string;
  /** Paliers de la charte : 28 / 20 / 17 / 15. Défaut 20. */
  size?: number;
  /** Défaut : 2 sous 16 px et pour les chevrons ou flèches, 1,8 sinon. */
  strokeWidth?: number;
  /** Défaut currentColor — une icône prend la couleur du texte qu'elle accompagne. */
  color?: string;
}

// Lucide expose une propriété par icône (PascalCase) sur son objet `icons` :
// on le relit en dictionnaire pour y chercher un nom composé dynamiquement.
type TraceLucide = ComponentType<
  SVGAttributes<SVGSVGElement> & { size?: number; strokeWidth?: number; color?: string }
>;
const TRACES = icons as unknown as Record<string, TraceLucide>;

// "chevron-right" → "ChevronRight", "corner-up-left" → "CornerUpLeft"
function versPascal(nom: string): string {
  return nom
    .replace(/-([a-z0-9])/gi, (_, lettre: string) => lettre.toUpperCase())
    .replace(/^([a-z])/, (lettre) => lettre.toUpperCase());
}

export function Icon({ name, size = 20, strokeWidth, color = "currentColor", ...rest }: IconProps) {
  const Trace = TRACES[versPascal(name)];
  const trait = strokeWidth ?? (size < 16 || /chevron|arrow/i.test(name) ? 2 : 1.8);

  // Nom inconnu : un cadre vide plutôt qu'un composant qui casse le rendu.
  if (!Trace) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth={trait}
        aria-hidden="true"
        {...rest}
      />
    );
  }

  return <Trace size={size} strokeWidth={trait} color={color} aria-hidden="true" {...rest} />;
}
