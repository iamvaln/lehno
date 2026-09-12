import type { TextStyle, ViewStyle } from "react-native";
import { nativeFont, nativeLetterSpacing, nativeSpace, nativeTouchMin, nativeTracking } from "@lehno/tokens";
import type { Couleurs } from "../theme.js";

/* L'en-tête d'un écran empilé : la flèche, et LE NOM DE L'ÉCRAN à côté.
 *
 * Le nom manquait partout. Chaque écran empilé dessinait sa flèche à la main et
 * s'ouvrait directement sur son contenu : on arrivait sur « Sécurité et
 * connexions » depuis les réglages, et l'écran ne disait pas où l'on était. Sur
 * huit écrans, la première chose lisible était une étiquette de section en
 * petites capitales grises — celle du premier bloc, pas le nom de la page.
 *
 * La planche, elle, porte un `AppHeader` sur TOUS les écrans empilés, et le nom
 * y tient sur la même ligne que la flèche.
 */

/* La flèche porte sa cible tactile de 44 points, et la MARGE NÉGATIVE la
   recale sur le bord : sans elle, l'icône paraîtrait rentrée de onze points
   par rapport au titre et au contenu dessous. C'est la même mécanique que la
   cloche, à l'autre bout de la rangée. */
const RECUL = nativeSpace[12];

export interface StyleDEntete {
  rangee: ViewStyle;
  retour: ViewStyle;
  titre: TextStyle;
}

export function styleDEntete(couleurs: Couleurs): StyleDEntete {
  return {
    rangee: {
      flexDirection: "row",
      alignItems: "center",
      gap: nativeSpace[8],
      marginLeft: -RECUL,
      /* La rangée ne se coupe pas quand le titre est long : c'est le TITRE qui
         s'élide, sur une ligne. Laisser la rangée grandir décalerait la flèche
         vers le milieu de deux lignes de texte. */
      minHeight: nativeTouchMin,
    },
    retour: {
      width: nativeTouchMin,
      height: nativeTouchMin,
      alignItems: "center",
      justifyContent: "center",
    },
    /* 17 points, la valeur de la planche : c'est un nom d'écran, pas le titre
       d'une page. Les écrans qui portent EN PLUS un grand titre — « Pour Awa »,
       « Bonjour, … » — le gardent ; celui-ci dit seulement où l'on est. */
    titre: {
      flex: 1,
      minWidth: 0,
      fontFamily: nativeFont.displayMedium,
      fontSize: 17,
      letterSpacing: nativeLetterSpacing(17, nativeTracking.title),
      color: couleurs.textBody,
    },
  };
}
