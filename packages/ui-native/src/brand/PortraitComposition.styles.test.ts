import { describe, expect, it } from "vitest";
import { contrastRatio, resolve } from "@lehno/tokens";
import { couleursDuLogotype } from "./Wordmark.data.js";
import {
  AMBIANCES, AMBIANCES_DE_PORTRAIT, FORMATS_DE_PORTRAIT, SCENES, THEME_DU_PORTRAIT,
  VOIES_DE_PORTRAIT, FAMILLES_ILLUSTREES, STYLES_DE_PHOTO,
} from "./PortraitComposition.data.js";
import {
  BORNES_DU_NOM, HAMPE, PAS_DE_LA_TRAME, PAS_DES_REGISTRES, REGISTRE,
  encresDeLaScene, hampesDeLaTrame, hauteurDuPortrait, lignesDesRegistres,
  motifDuPortrait, plafondDeLImage, styleDuPortrait, tailleDuMessage, tailleDuNom,
  texteDuPortrait, traitementDePhoto,
} from "./PortraitComposition.styles.js";

const PORTRAIT = resolve(THEME_DU_PORTRAIT);
const SOMBRE = resolve("dark");

// L'éprouve du brief : un nom de vingt caractères, un message de quatre
// phrases, pas de signature — puis la même composition à 200 points de large.
const NOM_LONG = "Marie-Ange Kouassi";
const MESSAGE_LONG = [
  "Tu refais le monde à minuit et tu nous ramènes au concret le lendemain.",
  "Cette année, tu as tenu tout le monde debout sans jamais le dire.",
  "On te doit plus que ce que tu acceptes d'entendre.",
  "Alors on l'écrit, une fois, noir sur blanc.",
].join(" ");

describe("le portrait n'a pas de thème", () => {
  /* LE DÉFAUT DU PORTAGE. Le portrait est une image fixe : l'ambiance est un
     choix de l'utilisateur, pas un réglage du téléphone. Mais le logotype du
     pied prend l'encre du TEXTE COURANT — donc du thème. Rendu sous le thème
     sombre, le mot « Lehno » virait au blanc sur le papier blanc de l'ambiance
     « papier » : 1,08:1, une marque effacée sur le seul contenu du produit qui
     sorte en la portant.

     Le portrait épingle donc son thème. Le test mesure la marque de CHAQUE
     ambiance contre la bande qui la porte, et vérifie que le thème de
     l'appareil ne la déplace pas. */
  it("garde sa marque lisible sur chaque ambiance, quel que soit le thème de l'appareil", () => {
    for (const nom of AMBIANCES_DE_PORTRAIT) {
      const A = AMBIANCES[nom];
      const c = couleursDuLogotype(A.marque, PORTRAIT);
      expect(contrastRatio(c.lettre, A.bande), `${nom} lettre`).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(c.accent, A.bande), `${nom} accent`).toBeGreaterThanOrEqual(3);
      // Et le fond, pour le gabarit sans image où la bande n'existe pas.
      expect(contrastRatio(c.lettre, A.fond), `${nom} lettre/fond`).toBeGreaterThanOrEqual(3);
    }
  });

  /* Et la mesure dit pourquoi l'épinglage existe : sous le thème sombre, la
     même marque s'efface sur le papier. Sans ce test, quelqu'un remplacerait
     `THEME_DU_PORTRAIT` par le thème courant sans que rien proteste. */
  it("s'effacerait si la marque suivait le thème de l'appareil", () => {
    const c = couleursDuLogotype(AMBIANCES.papier.marque, SOMBRE);
    expect(contrastRatio(c.lettre, AMBIANCES.papier.bande)).toBeLessThan(1.5);
  });

  /* Trois ambiances : le fond change, la structure non. Chacune doit porter son
     titre, son message et sa mention de façon lisible — une ambiance ajoutée
     avec une mention trop pâle passerait autrement inaperçue jusqu'à
     l'impression. */
  it("porte son texte sur chaque ambiance, bande et fond compris", () => {
    for (const nom of AMBIANCES_DE_PORTRAIT) {
      const A = AMBIANCES[nom];
      for (const [role, encre] of [["titre", A.titre], ["message", A.message], ["mention", A.mention]] as const) {
        for (const [ou, fond] of [["bande", A.bande], ["fond", A.fond]] as const) {
          expect(contrastRatio(encre, fond), `${nom}/${role}/${ou}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });
});

describe("la taille du nom", () => {
  /* L'interpolation du web n'était bornée qu'en apparence. Le test ne vérifie
     pas trois longueurs choisies : il balaie de 0 à 40 caractères et exige que
     la suite ne remonte jamais et ne sorte jamais des bornes. Un nom vide et un
     nom de quarante caractères sont tous deux des entrées réelles — le premier
     pendant la frappe, le second par un copier-coller. */
  it("décroît sans jamais sortir de ses bornes, de zéro à quarante caractères", () => {
    let precedent = Number.POSITIVE_INFINITY;
    for (let n = 0; n <= 40; n += 1) {
      const taille = tailleDuNom("x".repeat(n));
      expect(taille, `${n} caractères`).toBeLessThanOrEqual(BORNES_DU_NOM.haut);
      expect(taille, `${n} caractères`).toBeGreaterThanOrEqual(BORNES_DU_NOM.bas);
      expect(taille, `${n} caractères`).toBeLessThanOrEqual(precedent);
      precedent = taille;
    }
  });

  it("donne sa pleine taille à un prénom court", () => {
    expect(tailleDuNom("Ana")).toBe(BORNES_DU_NOM.haut);
    expect(tailleDuNom("")).toBe(BORNES_DU_NOM.haut);
  });
});

describe("la taille du message", () => {
  /* Quatre paliers, et le dernier borne l'échelle. `PALIERS.find()` rend
     `undefined` dès qu'un message dépasse le dernier seuil — c'est ce que le
     web risquait, et un message de mille mots n'a rien d'improbable dans un
     champ collé. */
  it("décroît par paliers et ne tombe jamais dans le vide", () => {
    let precedent = Number.POSITIVE_INFINITY;
    for (const mots of [0, 1, 16, 17, 30, 31, 46, 47, 200, 2000]) {
      const taille = tailleDuMessage("mot ".repeat(mots));
      expect(taille, `${mots} mots`).toBeTypeOf("number");
      expect(taille, `${mots} mots`).toBeGreaterThan(0);
      expect(taille, `${mots} mots`).toBeLessThanOrEqual(precedent);
      precedent = taille;
    }
  });

  // Un message vide ou fait d'espaces compte zéro mot, pas un.
  it("ne compte pas les blancs comme des mots", () => {
    expect(tailleDuMessage("")).toBe(tailleDuMessage("un seul mot"));
    expect(tailleDuMessage("   \n  ")).toBe(tailleDuMessage("court"));
  });
});

describe("le texte que prend le portrait", () => {
  /* Le vertical prend la version courte : agrandir le texte long dans un cadre
     haut le ferait déborder. Mais SANS version courte il reprend la longue —
     un portrait vide serait pire qu'un portrait serré, et c'est exactement ce
     qu'un `messageCourt` absent produisait au premier essai. */
  it("prend la version courte en vertical, et retombe sur la longue quand elle manque", () => {
    expect(texteDuPortrait({ message: "long", messageCourt: "court", format: "story" })).toBe("court");
    expect(texteDuPortrait({ message: "long", format: "story" })).toBe("long");
    expect(texteDuPortrait({ message: "long", messageCourt: "   ", format: "story" })).toBe("long");
  });

  // Le carré est la référence : il prend toujours le message entier, même
  // quand la version courte existe.
  it("garde le message entier en carré", () => {
    expect(texteDuPortrait({ message: "long", messageCourt: "court", format: "carre" })).toBe("long");
  });
});

describe("les motifs du portrait", () => {
  /* DEUX MOTIFS, JAMAIS LES DEUX. La trame accepte du texte par-dessus ; les
     registres prennent le fond entier du gabarit sans image. Les poser ensemble
     ferait un tissu. Le test balaie les trois voies : une quatrième devra
     choisir. */
  it("ne pose jamais qu'un motif à la fois, quelle que soit la voie", () => {
    for (const voie of VOIES_DE_PORTRAIT) {
      const motif = motifDuPortrait(voie);
      expect(["trame", "registres"], voie).toContain(motif);
      expect(motif === "registres", voie).toBe(voie === "aucune");
    }
  });

  /* LA BANDE CHAUVE. Le web posait un `<pattern>` qui se répète tout seul ; en
     natif les positions se calculent, et une hauteur supposée laisse une bande
     nue dès que le message passe à quatre lignes. Le test éprouve des hauteurs
     de bande réalistes, du message d'une ligne au message de six. */
  it("couvre la bande entière, si haute et si large soit-elle", () => {
    for (const hauteur of [30, 60, 120, 300, 900]) {
      for (const largeur of [200, 380, 1080]) {
        const hampes = hampesDeLaTrame(largeur, hauteur);
        expect(hampes.length, `${largeur}×${hauteur}`).toBeGreaterThan(0);
        const basse = Math.max(...hampes.map((h) => h.y));
        const droite = Math.max(...hampes.map((h) => h.x));
        expect(basse, `${largeur}×${hauteur} bas`).toBeGreaterThan(hauteur - PAS_DE_LA_TRAME.y);
        expect(droite, `${largeur}×${hauteur} droite`).toBeGreaterThan(largeur - PAS_DE_LA_TRAME.x);
        // Et rien ne déborde du haut ni de la gauche.
        expect(Math.min(...hampes.map((h) => h.y))).toBe(HAMPE.y);
        expect(Math.min(...hampes.map((h) => h.x))).toBe(HAMPE.x);
      }
    }
  });

  it("couvre aussi le fond entier de registres", () => {
    for (const hauteur of [40, 200, 1080]) {
      const lignes = lignesDesRegistres(hauteur);
      expect(lignes.length, String(hauteur)).toBeGreaterThan(0);
      expect(Math.max(...lignes), String(hauteur)).toBeGreaterThan(hauteur - PAS_DES_REGISTRES);
      expect(Math.min(...lignes)).toBe(REGISTRE.y);
    }
  });

  // Une boîte vide ne rend rien plutôt que de boucler : la bande peut être
  // mesurée à zéro le temps d'une passe de disposition.
  it("ne boucle pas sur une boîte vide", () => {
    expect(hampesDeLaTrame(0, 100)).toEqual([]);
    expect(hampesDeLaTrame(100, 0)).toEqual([]);
    expect(hampesDeLaTrame(-10, -10)).toEqual([]);
    expect(lignesDesRegistres(0)).toEqual([]);
  });
});

describe("la scène illustrée", () => {
  it("garde trois ou quatre éléments par famille, jamais un catalogue", () => {
    for (const famille of FAMILLES_ILLUSTREES) {
      expect(SCENES[famille].length, famille).toBeGreaterThanOrEqual(3);
      expect(SCENES[famille].length, famille).toBeLessThanOrEqual(5);
    }
  });

  /* L'HOMMAGE EST À PART : il neutralise l'abricot. Une occasion sensible ne
     peut pas partager le vif d'une déclaration de fierté — et c'est le genre de
     règle qui se perd quand on ajoute une ambiance. Le test la tient pour les
     trois. */
  it("éteint le vif de l'hommage sur chaque ambiance", () => {
    for (const nom of AMBIANCES_DE_PORTRAIT) {
      const A = AMBIANCES[nom];
      const ordinaire = encresDeLaScene(A, false);
      const hommage = encresDeLaScene(A, true);
      expect(ordinaire.accent, nom).toBe(A.illustration[2]);
      expect(hommage.accent, nom).toBe(hommage.profond);
      expect(hommage.accent, nom).not.toBe(ordinaire.accent);
      // Le reste de la scène ne bouge pas : c'est le vif qui cède, pas la
      // composition.
      expect(hommage.clair, nom).toBe(ordinaire.clair);
      expect(hommage.moyen, nom).toBe(ordinaire.moyen);
    }
  });
});

describe("le traitement de la photo", () => {
  /* Les trois traitements sont des noms de la marque : l'utilisateur les
     choisit. RN n'a ni désaturation ni fusion de calques — s'ils rendaient tous
     la même chose, le choix deviendrait décoratif. Le test exige qu'ils
     restent distincts sur chaque ambiance. */
  it("garde les trois traitements distincts, sur chaque ambiance", () => {
    for (const nom of AMBIANCES_DE_PORTRAIT) {
      const A = AMBIANCES[nom];
      const vus = new Set(
        STYLES_DE_PHOTO.map((s) => {
          const t = traitementDePhoto(s, A);
          return `${t.teinte}/${t.opacite}/${t.monochrome}`;
        }),
      );
      expect(vus.size, nom).toBe(STYLES_DE_PHOTO.length);
    }
  });

  // La silhouette est le seul traitement qui éteint l'image en une encre —
  // `tintColor`, l'équivalent natif exact. Les deux autres la voilent.
  it("n'éteint l'image qu'en silhouette", () => {
    expect(traitementDePhoto("silhouette", AMBIANCES.papier).monochrome).toBe(true);
    expect(traitementDePhoto("lumiere", AMBIANCES.papier).monochrome).toBe(false);
    expect(traitementDePhoto("serigraphie", AMBIANCES.papier).monochrome).toBe(false);
  });
});

describe("la composition", () => {
  // Le carré est la référence ; le vertical en dérive, et il est plus haut.
  it("tient le rapport de chaque format", () => {
    expect(hauteurDuPortrait(380, "carre")).toBe(380);
    expect(hauteurDuPortrait(1080, "story")).toBeCloseTo(1920, 6);
  });

  /* L'image cède, la bande non. Le plafond est plus bas en vertical, où le
     cadre donne les moyens de laisser respirer les mots — et dans les deux cas
     l'image ne prend jamais la moitié : le message est le contenu principal. */
  it("ne laisse jamais l'image prendre la moitié du cadre", () => {
    for (const format of FORMATS_DE_PORTRAIT) {
      expect(plafondDeLImage(format), format).toBeLessThan(0.5);
    }
    expect(plafondDeLImage("story")).toBeLessThan(plafondDeLImage("carre"));
  });

  /* L'ÉPREUVE DU BRIEF : un nom de vingt caractères, un message de quatre
     phrases, puis la même composition à 200 points de large. Rien ne se pose à
     la main : tout se déduit de la largeur, donc tout doit rester positif et
     proportionnel. Un `cqw` traduit en points fixes casserait ici. */
  it("reste proportionnelle du plein écran à deux cents points", () => {
    for (const format of FORMATS_DE_PORTRAIT) {
      const petit = styleDuPortrait({ nom: NOM_LONG, message: MESSAGE_LONG, largeur: 200, format });
      const grand = styleDuPortrait({ nom: NOM_LONG, message: MESSAGE_LONG, largeur: 1080, format });
      const rapport = 1080 / 200;
      expect(Number(grand.nom.fontSize), format).toBeCloseTo(Number(petit.nom.fontSize) * rapport, 6);
      expect(Number(grand.message.fontSize), format).toBeCloseTo(Number(petit.message.fontSize) * rapport, 6);
      expect(grand.hauteurDeLaMarque, format).toBeCloseTo(petit.hauteurDeLaMarque * rapport, 6);
      for (const taille of [petit.nom.fontSize, petit.message.fontSize, petit.note.fontSize, petit.mention.fontSize]) {
        expect(Number(taille), format).toBeGreaterThan(0);
      }
    }
  });

  // Le gabarit sans image ne réserve pas de bande : le texte respire sur toute
  // la surface, et c'est le fond — pas la bande — qui le porte.
  it("laisse le texte prendre toute la surface quand il n'y a pas d'image", () => {
    const avec = styleDuPortrait({ nom: "Ana", message: "un mot", largeur: 380, voie: "illustration" });
    const sans = styleDuPortrait({ nom: "Ana", message: "un mot", largeur: 380, voie: "aucune" });
    expect(avec.bande.backgroundColor).toBe(AMBIANCES.papier.bande);
    expect(sans.bande.backgroundColor).toBe(AMBIANCES.papier.fond);
    expect(sans.bande.flex).toBe(1);
  });
});
