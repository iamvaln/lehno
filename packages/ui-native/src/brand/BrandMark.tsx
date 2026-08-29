import Svg, { Circle, G, Path, Rect } from "react-native-svg";
import { useCouleurs } from "../ThemeProvider.js";
import {
  BOITE_PASTILLE, RAYON_PASTILLE, TRACE_DE_LA_PASTILLE, styleDePastille,
  type VarianteDePastille,
} from "./BrandMark.styles.js";

export interface BrandMarkProps {
  variant?: VarianteDePastille | undefined;
  /** Jamais sous 28 points — la primitive relève ce qu'on lui donne de moins. */
  size?: number | undefined;
}

/* La pastille, dessinée depuis le même h que le logotype. Le lecteur d'écran
   entend « Lehno » : c'est un nom, pas une image décorative. */
export function BrandMark({ variant = "violet", size = 32 }: BrandMarkProps) {
  const couleurs = useCouleurs();
  const s = styleDePastille({ couleurs, variante: variant, taille: size });

  return (
    <Svg
      width={s.taille}
      height={s.taille}
      viewBox={`0 0 ${BOITE_PASTILLE} ${BOITE_PASTILLE}`}
      accessibilityRole="image"
      accessibilityLabel="Lehno"
    >
      {s.plaque !== null && s.forme === "ronde" ? (
        <Circle
          cx={BOITE_PASTILLE / 2} cy={BOITE_PASTILLE / 2} r={BOITE_PASTILLE / 2}
          fill={s.plaque}
        />
      ) : null}
      {s.plaque !== null && s.forme === "carre" ? (
        <Rect
          width={BOITE_PASTILLE} height={BOITE_PASTILLE} rx={RAYON_PASTILLE}
          fill={s.plaque}
        />
      ) : null}
      <G transform={`translate(${s.repere.x} ${s.repere.y}) scale(${s.repere.echelle} ${-s.repere.echelle})`}>
        <Path
          d={TRACE_DE_LA_PASTILLE}
          fill={s.lettre}
          /* Le favicon épaissit son tracé — jointures en pointe, comme le
             fichier d'origine, sans quoi les angles du h s'arrondiraient. */
          {...(s.trait > 0
            ? { stroke: s.lettre, strokeWidth: s.trait, strokeLinejoin: "miter" as const, strokeMiterlimit: 3 }
            : {})}
        />
      </G>
    </Svg>
  );
}
