import { describe, expect, it } from "vitest";
import {
  nativeColors, nativeDuration, nativeEasing, nativeFont, nativeLeading,
  nativeBorder, nativeLetterSpacing, nativeTracking,
  nativeLineHeight, nativeRadius, nativeSize, nativeSpace, nativeTouchMin,
  resolve, SEMANTIC_ROLES, spacing, typography,
} from "./index.js";

describe("émission React Native", () => {
  // La raison d'être du fichier : React Native ne résout pas var(), donc les
  // couleurs doivent traverser en valeurs. Elles se dérivent de resolve, jamais
  // ne se recopient — une recopie a déjà divergé une fois, sur le gris de
  // mention, et c'est le test de contraste qui l'a trouvée.
  it("rend chaque rôle sémantique avec la couleur de resolve", () => {
    for (const theme of ["light", "dark"] as const) {
      const attendu = resolve(theme);
      const rendu = nativeColors(theme);
      for (const role of SEMANTIC_ROLES) {
        expect(rendu[role], `${theme}.${role}`).toBe(attendu[role]);
      }
    }
  });

  // En CSS une taille est une chaîne avec son unité ; en RN c'est un nombre nu.
  // Les demies comptent : 13,5 et 11,5 sont les deux tailles qui distinguent le
  // secondaire de la mention, et un arrondi les confondrait.
  it("dérive les tailles en nombres, demies comprises", () => {
    expect(nativeSize.displayXl).toBe(76);
    expect(nativeSize.bodyXs).toBe(13.5);
    expect(nativeSize.mentionS).toBe(11.5);
  });

  // Sans ce test, une taille ajoutée à la charte n'atteindrait jamais le natif :
  // le port continuerait de rendre, avec une échelle en retard d'une version.
  it("ne laisse aucune taille de la charte derrière elle", () => {
    const attendues = Object.keys(typography)
      .filter((cle) => cle.startsWith("text"))
      .map((cle) => cle.slice(4, 5).toLowerCase() + cle.slice(5));
    expect(Object.keys(nativeSize).sort()).toEqual(attendues.sort());
  });

  // L'échelle se lit space[16], comme sur le web elle se lit --space-16 : c'est
  // le pas qui nomme la valeur, pas un rang abstrait.
  it("dérive l'échelle d'espacement, indexée par son pas", () => {
    expect(nativeSpace[16]).toBe(16);
    expect(nativeSpace[56]).toBe(56);
    expect(Object.keys(nativeSpace)).toHaveLength(
      Object.keys(spacing).filter((cle) => cle.startsWith("space")).length,
    );
  });

  // 62ch, clamp() et la gouttière d'une page large décrivent une mise en page de
  // navigateur. RN n'a ni ch ni clamp, et un téléphone n'a pas de gouttière : les
  // laisser passer produirait des nombres qui ont l'air justes et ne le sont pas.
  it("laisse au web ce qui n'a pas de sens sur un téléphone", () => {
    for (const absent of ["measure", "measureTight", "sectionPadY", "pageMax", "pageGutter"]) {
      expect(Object.keys(nativeSpace), absent).not.toContain(absent);
    }
  });

  // La valeur que le pilote affichait à 48 en l'attribuant à la charte. Elle est
  // à 44, et elle vit à part : c'est un plancher tactile, pas un pas d'échelle.
  it("porte la cible tactile à part, et elle vaut 44", () => {
    expect(nativeTouchMin).toBe(44);
  });

  it("ne porte que les rayons que React Native sait rendre", () => {
    expect(nativeRadius.lg).toBe(13);
    expect(nativeRadius.pill).toBe(999);
    // radiusTile vaut 22% — RN ne rend pas un rayon en pourcentage.
    expect(nativeRadius).not.toHaveProperty("tile");
    // Le châssis d'appareil est un décor d'aperçu, explicitement hors produit.
    expect(nativeRadius).not.toHaveProperty("device");
  });

  /* L'épaisseur d'un trait est un jeton, pas un chiffre évident. Elle a été
     écrite « 1 » en dur dans neuf primitives avant que ce test n'existe — et
     c'est précisément la dérive que ce fichier doit empêcher : le jour où la
     charte passe le filet à 0,5, neuf endroits resteraient à 1. */
  it("dérive les deux épaisseurs de trait", () => {
    expect(nativeBorder.width).toBe(1);
    expect(nativeBorder.widthFirm).toBe(2);
  });

  /* Ce que le natif écarte doit être écarté PAR DÉCISION, pas par oubli. La
     densité décrit un outil qui se manipule à la souris — hauteur de contrôle,
     hauteur de ligne, largeur de barre latérale, que le produit met d'ailleurs
     à zéro. Sur un téléphone, c'est la cible tactile qui commande.
     L'anneau de focus n'a pas d'objet non plus : il n'existe que pour un
     clavier, et le port ne vise pas ce cas. */
  it("laisse au web la densité de souris et l'anneau de focus", () => {
    for (const absent of ["controlHeight", "controlPadX", "rowHeight", "focusWidth", "focusOffset"]) {
      expect(Object.keys(nativeBorder), absent).not.toContain(absent);
    }
    expect(nativeBorder).toEqual({ width: 1, widthFirm: 2 });
  });

  it("dérive les durées en millisecondes nues", () => {
    expect(nativeDuration.state).toBe(120);
    expect(nativeDuration.enter).toBe(220);
    expect(nativeDuration.screen).toBe(340);
  });

  // RN ne lit pas cubic-bezier() : Easing.bezier prend quatre nombres. La
  // conversion est la seule façon de garder les courbes du logo animé.
  it("dérive les courbes en quatre nombres", () => {
    expect(nativeEasing.pose).toEqual([0.22, 0.8, 0.24, 1]);
    expect(nativeEasing.traverse).toEqual([0.36, 0, 0.16, 1]);
  });

  // « ease-out » est un mot-clé CSS, pas une courbe écrite. Le laisser tomber
  // priverait les changements d'état de leur courbe ; la spec CSS en donne
  // l'équivalent exact, on l'emploie plutôt que d'en inventer un approchant.
  it("traduit le mot-clé ease-out par sa définition de la spec CSS", () => {
    expect(nativeEasing.state).toEqual([0, 0, 0.58, 1]);
  });

  // RN ne résout pas une famille par graisse : il charge une police par nom.
  // Les noms sont donc ceux des fichiers .ttf, et ils se dérivent — c'est ce
  // qui garantit que le nom cuit par le script est celui que le style demande.
  it("nomme des instances statiques, pas des axes de graisse", () => {
    expect(nativeFont.displayRegular).toBe("Fraunces-Regular");
    expect(nativeFont.displayMedium).toBe("Fraunces-Medium");
    expect(nativeFont.bodySemibold).toBe("Karla-Semibold");
    expect(nativeFont.bodyBold).toBe("Karla-Bold");
  });

  // Le web obtenait l'italique par fontStyle sur la même famille. RN veut une
  // police à part : sans elle, Quote et la signature du portrait rendent droit.
  it("porte les italiques, que le web obtenait par fontStyle", () => {
    expect(nativeFont.displayItalic).toBe("Fraunces-Italic");
    expect(nativeFont.displayMediumItalic).toBe("Fraunces-MediumItalic");
  });

  // Karla 300 était déclarée sans être employée nulle part. Un jeton inutilisé
  // finit par être utilisé, et il aurait fallu embarquer un fichier pour rien.
  it("ne porte aucune graisse que le produit n'emploie pas", () => {
    expect(nativeFont).not.toHaveProperty("bodyLight");
    expect(typography).not.toHaveProperty("fontBodyLight");
  });

  // L'interlettrage est un facteur de la taille en CSS (em) et une valeur
  // absolue en RN. Le sur-titre en capitales ne tient que par lui : sans
  // conversion, « CE QUI APPROCHE » rendrait serré au lieu d'espacé.
  it("rend l'interlettrage en points, depuis les em de la charte", () => {
    expect(nativeTracking.kicker).toBe(0.14);
    expect(nativeLetterSpacing(nativeSize.kicker, nativeTracking.kicker)).toBeCloseTo(1.54, 2);
  });

  // Les titres se resserrent : un em négatif doit le rester une fois converti.
  it("garde le signe d'un resserrement", () => {
    expect(nativeLetterSpacing(nativeSize.displayS, nativeTracking.display)).toBeCloseTo(-0.9, 2);
  });

  // En CSS l'interlignage est un facteur qui suit la taille ; en RN c'est une
  // valeur absolue. La conversion se fait à l'usage, pas dans le jeton.
  it("rend l'interlignage en valeur absolue", () => {
    expect(nativeLeading.body).toBe(1.55);
    expect(nativeLineHeight(nativeSize.bodyM, nativeLeading.body)).toBe(25);
    expect(nativeLineHeight(nativeSize.displayS, nativeLeading.display)).toBe(32);
  });
});
