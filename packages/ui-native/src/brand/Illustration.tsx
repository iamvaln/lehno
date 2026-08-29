import Svg, { Circle, Ellipse, Path, Rect } from "react-native-svg";
import { useCouleurs } from "../ThemeProvider.js";
import { BOITE, ILLUSTRATIONS, type Forme } from "./Illustration.data.js";
import { couleursDIllustration, hauteurDIllustration } from "./Illustration.styles.js";

export interface IllustrationProps {
  name: string;
  width?: number | undefined;
}

/* Elles réchauffent les écrans où il n'y a rien à montrer, et rien d'autre.
   Aucune n'est décorative : chacune occupe la place que le contenu n'occupe
   pas encore. Le lecteur d'écran les ignore — le titre de l'état vide dit
   déjà ce qu'il y a à dire. */
export function Illustration({ name, width = 160 }: IllustrationProps) {
  const couleurs = useCouleurs();
  const formes = ILLUSTRATIONS[name];
  // Un nom inconnu ne rend rien plutôt que de faire tomber l'écran.
  if (!formes) return null;

  const encre = couleursDIllustration(couleurs);
  const rendre = ([tag, attrs]: Forme, rang: number) => {
    const fill = encre[attrs.fill];
    switch (tag) {
      case "path":
        return <Path key={rang} d={attrs.d} fill={fill} {...(attrs.fillRule ? { fillRule: attrs.fillRule } : {})} />;
      case "rect":
        // `rx` est facultatif : sous exactOptionalPropertyTypes, il se pose ou
        // ne se pose pas, il ne se pose pas « à undefined ».
        return (
          <Rect
            key={rang} x={attrs.x} y={attrs.y} width={attrs.width} height={attrs.height}
            fill={fill} {...(attrs.rx !== undefined ? { rx: attrs.rx } : {})}
          />
        );
      case "ellipse":
        return <Ellipse key={rang} cx={attrs.cx} cy={attrs.cy} rx={attrs.rx} ry={attrs.ry} fill={fill} />;
      default:
        return <Circle key={rang} cx={attrs.cx} cy={attrs.cy} r={attrs.r} fill={fill} />;
    }
  };

  return (
    <Svg
      width={width}
      height={hauteurDIllustration(width)}
      viewBox={`0 0 ${BOITE.largeur} ${BOITE.hauteur}`}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {formes.map(rendre)}
    </Svg>
  );
}
