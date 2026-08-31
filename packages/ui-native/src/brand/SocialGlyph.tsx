import Svg, { Path } from "react-native-svg";
import { useCouleurs } from "../ThemeProvider.js";
import { BOITE_DE_GLYPHE } from "./SocialGlyph.data.js";
import { styleDeGlyphe } from "./SocialGlyph.styles.js";

export interface SocialGlyphProps {
  reseau: string;
  /** Palier du système : 17 points. Sous 16, X et TikTok deviennent illisibles. */
  size?: number | undefined;
  /** Sans couleur, le glyphe prend celle du texte courant. */
  color?: string | undefined;
}

/* Les vraies marques, posées nues pour prendre l'encre du texte qu'elles
   accompagnent — ce que le web obtenait par un masque CSS, absent du natif.
   Le glyphe ne se lit pas : c'est le libellé voisin qui nomme le compte. */
export function SocialGlyph({ reseau, size, color }: SocialGlyphProps) {
  const couleurs = useCouleurs();
  const s = styleDeGlyphe({
    couleurs, reseau,
    ...(size !== undefined ? { taille: size } : {}),
    ...(color !== undefined ? { encre: color } : {}),
  });
  if (!s) return null;

  return (
    <Svg
      width={s.taille}
      height={s.taille}
      viewBox={`0 0 ${BOITE_DE_GLYPHE} ${BOITE_DE_GLYPHE}`}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Path d={s.trace} fill={s.encre} />
    </Svg>
  );
}
