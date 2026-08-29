import Svg, { G, Path } from "react-native-svg";
import { useCouleurs } from "../ThemeProvider.js";
import {
  BOITE_LOGOTYPE, LETTRES, REPERE, couleursDuLogotype, type VarianteDeLogotype,
} from "./Wordmark.data.js";

export interface WordmarkProps {
  variant?: VarianteDeLogotype | undefined;
  height?: number | undefined;
}

/* Le mot, dessiné depuis ses cinq tracés — la même source que l'animation
   d'ouverture. Le lecteur d'écran entend « Lehno » : c'est un nom, pas une
   image décorative. */
export function Wordmark({ variant = "couleur", height = 24 }: WordmarkProps) {
  const couleurs = useCouleurs();
  const c = couleursDuLogotype(variant, couleurs);
  const largeur = height * (BOITE_LOGOTYPE.largeur / BOITE_LOGOTYPE.hauteur);

  return (
    <Svg
      width={largeur}
      height={height}
      viewBox={`0 0 ${BOITE_LOGOTYPE.largeur} ${BOITE_LOGOTYPE.hauteur}`}
      accessibilityRole="image"
      accessibilityLabel="Lehno"
    >
      <G transform={`translate(${REPERE.x} ${REPERE.y}) scale(${REPERE.echelle} ${-REPERE.echelle})`}>
        {LETTRES.map((lettre, rang) => (
          <G key={rang} transform={`translate(${lettre.tx} 0)`}>
            <Path d={lettre.d} fill={lettre.accent ? c.accent : c.lettre} />
          </G>
        ))}
      </G>
    </Svg>
  );
}
