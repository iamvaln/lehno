import { describe, expect, it } from "vitest";
import {
  NATURES_DE_CHAMP, nettoiePourLaNature, reglagesDeSaisie,
} from "./TextField.nature.js";

describe("la nature d'un champ", () => {
  /* React Native capitalise la première lettre par défaut — `autoCapitalize`
     vaut « sentences ». Sur une adresse électronique, il rend « Valentine@… »
     que le serveur refuse, et la personne ne voit pas ce qui cloche : la
     majuscule est discrète et l'erreur arrive au bout du réseau. */
  it("ne capitalise jamais une adresse ni un pseudo", () => {
    for (const nature of ["email", "pseudo"] as const) {
      expect(reglagesDeSaisie(nature).autoCapitalize, nature).toBe("none");
    }
  });

  // Le correcteur automatique remplace une adresse par un mot du dictionnaire.
  it("coupe la correction automatique là où elle nuit", () => {
    for (const nature of ["email", "pseudo", "code"] as const) {
      expect(reglagesDeSaisie(nature).autoCorrect, nature).toBe(false);
    }
  });

  // Le bon clavier épargne trois gestes : l'arobase et le point sont sur la
  // rangée principale du clavier d'adresse.
  it("demande le clavier de la nature", () => {
    expect(reglagesDeSaisie("email").keyboardType).toBe("email-address");
    expect(reglagesDeSaisie("code").keyboardType).toBe("number-pad");
    expect(reglagesDeSaisie("texte").keyboardType).toBeUndefined();
  });

  /* Le remplissage automatique du système : l'adresse depuis le trousseau, le
     code depuis le message reçu. Sans ces deux-là, la proposition n'apparaît
     pas au-dessus du clavier — et c'est la façon dont la plupart des gens
     saisissent l'un comme l'autre. */
  it("laisse le système proposer ce qu'il connaît", () => {
    expect(reglagesDeSaisie("email").textContentType).toBe("emailAddress");
    expect(reglagesDeSaisie("code").textContentType).toBe("oneTimeCode");
  });

  // Une phrase ordinaire garde les usages du système : majuscule en début de
  // phrase, correcteur actif. Y toucher serait gênant sur une note.
  it("laisse le texte ordinaire tranquille", () => {
    const r = reglagesDeSaisie("texte");
    expect(r.autoCapitalize).toBe("sentences");
    expect(r.autoCorrect).toBe(true);
  });

  it("connaît toutes ses natures", () => {
    for (const nature of NATURES_DE_CHAMP) {
      expect(reglagesDeSaisie(nature), nature).toBeDefined();
    }
  });
});

/* UN CODE DE PARRAINAGE N'EST PAS UN PSEUDO, et la confusion coûtait le
   premier caractère. Le serveur engendre `_XXY2YWO` ; la nature « pseudo »
   retire les séparateurs de tête — à raison pour un pseudo, à tort ici. Le
   champ affichait alors `XXY2YWO`, que le serveur refuse : un code valide
   devenait invalide en silence, sans que personne puisse comprendre pourquoi. */
describe("une référence qu'on recopie", () => {
  it("garde le tiret bas de tête, que le pseudo retirait", () => {
    expect(nettoiePourLaNature("reference", "_XXY2YWO")).toBe("_XXY2YWO");
    expect(nettoiePourLaNature("pseudo", "_XXY2YWO")).toBe("XXY2YWO");
  });

  // Un code collé depuis un message arrive souvent avec une espace.
  it("retire les espaces du collage, et rien d'autre", () => {
    expect(nettoiePourLaNature("reference", "  _XXY2YWO ")).toBe("_XXY2YWO");
  });

  /* AUCUNE RÈGLE DE FORME : le contrat ne dit que `max(16)`. En inventer une
     ici, c'est refuser demain un code que le serveur produira autrement. */
  it("ne juge pas la forme du code", () => {
    expect(nettoiePourLaNature("reference", "ab-12.XY")).toBe("ab-12.XY");
    expect(nettoiePourLaNature("reference", "é@#")).toBe("é@#");
  });

  it("s'arrête à la borne du contrat", () => {
    expect(reglagesDeSaisie("reference").maxLength).toBe(16);
  });
});

/* UNE ANNÉE N'EST PAS UN CODE À USAGE UNIQUE.
 *
 * Le champ d'année de naissance empruntait la nature « code ». Il en héritait
 * `textContentType: "oneTimeCode"` et `autoComplete: "sms-otp"` : iOS proposait
 * LE DERNIER CODE REÇU PAR SMS au-dessus du clavier, sur une date de naissance.
 * Et faute de borne, on y saisissait cinq chiffres — vu à l'écran, « 19905 ».
 */
describe("une année de naissance", () => {
  it("ne propose pas le dernier code reçu par SMS", () => {
    const r = reglagesDeSaisie("annee");
    expect(r.textContentType).toBeUndefined();
    expect(r.autoComplete).toBeUndefined();
    // Ce que « code » fait, et qu'il ne faut pas ici.
    expect(reglagesDeSaisie("code").textContentType).toBe("oneTimeCode");
  });

  it("s'arrête à quatre chiffres", () => {
    expect(reglagesDeSaisie("annee").maxLength).toBe(4);
  });

  it("garde le pavé numérique, et n'accepte que des chiffres", () => {
    expect(reglagesDeSaisie("annee").keyboardType).toBe("number-pad");
    expect(nettoiePourLaNature("annee", "19a90")).toBe("1990");
  });
});


/* UN NUMÉRO DE TÉLÉPHONE — celui depuis lequel on a versé.
 *
 * Il retombait sur « texte » : clavier alphabétique, majuscule et correcteur
 * actifs. On tapait donc son numéro sur des lettres, avec le correcteur qui
 * proposait des mots. Vu à l'écran, sur l'écran de déclaration d'un versement.
 */
describe("un numéro de téléphone", () => {
  it("ouvre un pavé téléphonique, pas un clavier de lettres", () => {
    const r = reglagesDeSaisie("telephone");
    expect(r.keyboardType).toBe("phone-pad");
    expect(r.autoCorrect).toBe(false);
    expect(r.autoCapitalize).toBe("none");
  });

  /* `phone-pad` et non `number-pad` : un numéro porte parfois un « + », des
     espaces, des tirets. Le pavé des chiffres seuls les refuserait, et
     quelqu'un qui colle un numéro international resterait coincé. */
  it("laisse passer la ponctuation d'un numéro", () => {
    expect(nettoiePourLaNature("telephone", "+237 691 23 45 67")).toBe("+237 691 23 45 67");
  });

  it("s'arrête à la borne du contrat", () => {
    expect(reglagesDeSaisie("telephone").maxLength).toBe(32);
  });
});
