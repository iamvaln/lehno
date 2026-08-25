import { describe, expect, it } from "vitest";
import { classer, CODES } from "../src/me/note-classifier.js";

// Une fonction pure : ni base, ni Nest, ni conteneur. C'est aussi la partie qui
// changera le plus souvent, d'où son fichier à elle.
describe("classement d'une note", () => {
  it("connaît les sept codes du dictionnaire, et rien d'autre", () => {
    expect([...CODES].sort()).toEqual([
      "challenges", "dislikes_nogo", "encouragements", "facts",
      "gift_ideas", "interests", "message_ideas",
    ]);
  });

  it.each([
    ["Il a parlé d'un cadeau qu'il aimerait avoir", "gift_ideas"],
    ["Elle adore le cinéma coréen", "interests"],
    ["Je ne bois pas d'alcool", "dislikes_nogo"],
    ["Il traverse une période difficile au travail", "challenges"],
  ])("range « %s » dans %s", (texte, attendu) => {
    expect(classer(texte)).toContain(attendu);
  });

  // Le double rattachement est voulu : une difficulté relève de ce qu'il
  // traverse ET de ce qu'il a besoin d'entendre (doc fonctionnelle §7).
  it("peut ranger une note dans deux catégories", () => {
    const c = classer("Il traverse une période difficile, il a besoin qu'on le soutienne");
    expect(c).toContain("challenges");
    expect(c).toContain("encouragements");
  });

  // Une note qu'on ne sait pas ranger ne se range NULLE PART. Le classement
  // sert la lisibilité de la fiche ; la génération, elle, lit le CONTENU des
  // notes. Une note non classée nourrit donc le message comme les autres.
  it("ne range nulle part ce qu'il ne sait pas classer", () => {
    expect(classer("azerty qwerty")).toEqual([]);
  });

  it("ne rend jamais deux fois la même catégorie", () => {
    const c = classer("cadeau cadeau idée cadeau");
    expect(new Set(c).size).toBe(c.length);
  });

  it("ignore la casse et les accents", () => {
    expect(classer("ELLE ADORE LE CINÉMA")).toContain("interests");
    expect(classer("elle adore le cinema")).toContain("interests");
  });

  // « dislikes_nogo » n'est pas une étiquette d'affichage comme les six autres.
  // La doc fonctionnelle §8 en fait une CONTRAINTE ACTIVE : elle écarte les
  // idées de cadeau et les formulations incompatibles — « ne pas proposer de
  // vin à une personne qui ne boit pas ». La rater a une conséquence réelle
  // dans ce que le produit propose, là où confondre « faits » et « intérêts »
  // ne coûte qu'un rangement approximatif. Elle mérite donc ses propres cas.
  describe("le refus, seule catégorie qui contraint le produit", () => {
    it.each([
      "Elle n'aime pas le cinéma",
      "Il n'aime pas les fleurs",
      "Elle ne supporte pas le bruit",
      "Il est allergique aux arachides",
      "Elle ne veut pas de parfum",
      "Il déteste les surprises",
    ])("repère le refus dans « %s »", (texte) => {
      expect(classer(texte)).toContain("dislikes_nogo");
    });

    // Le piège : « n'aime pas » contient « aime ». Sans traitement de la
    // négation, la phrase tombe dans « intérêts » — et le produit propose
    // exactement ce que la personne rejette.
    it("un refus n'est jamais rangé aussi dans les intérêts", () => {
      expect(classer("Elle n'aime pas le cinéma")).not.toContain("interests");
      expect(classer("Il n'aime pas les fleurs")).not.toContain("interests");
    });

    // L'inverse doit rester vrai : un goût franc reste un goût.
    it("un goût sans refus reste un intérêt", () => {
      const c = classer("Elle aime le cinéma");
      expect(c).toContain("interests");
      expect(c).not.toContain("dislikes_nogo");
    });
  });
});
