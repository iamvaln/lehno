import { describe, expect, it } from "vitest";
import { NATURES_DE_CHAMP, reglagesDeSaisie } from "./TextField.nature.js";

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
