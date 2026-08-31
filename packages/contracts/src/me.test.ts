import { describe, expect, it } from "vitest";
import { createPersonSchema, updatePersonSchema, personSchema, PERSON_REGISTERS } from "./me.js";
import { profileSchema } from "./profile.js";

describe("contrats des proches", () => {
  it("exige un nom d'usage non vide", () => {
    expect(createPersonSchema.safeParse({ gender: "female", displayName: "" }).success).toBe(false);
    expect(createPersonSchema.safeParse({ gender: "female", displayName: "Awa" }).success).toBe(true);
  });

  // Le registre gouverne le ton des messages produits : trois valeurs, pas une
  // chaîne libre (voir dictionnaire, enum person_register).
  it("n'accepte que les trois registres du dictionnaire", () => {
    expect(PERSON_REGISTERS).toEqual(["familier", "amical", "formel"]);
    expect(createPersonSchema.safeParse({ gender: "female", displayName: "Awa", register: "copain" }).success).toBe(false);
    expect(createPersonSchema.safeParse({ gender: "female", displayName: "Awa", register: "amical" }).success).toBe(true);
  });

  // .strict() : un champ inattendu fait échouer, il ne se laisse pas ignorer.
  it("refuse un champ inconnu", () => {
    expect(createPersonSchema.safeParse({ gender: "female", displayName: "Awa", isSelf: true }).success).toBe(false);
  });

  // La mise à jour n'a pas de champ obligatoire, mais elle en exige au moins un :
  // un PATCH vide est une requête qui ne veut rien dire.
  it("exige au moins un champ à la mise à jour", () => {
    expect(updatePersonSchema.safeParse({}).success).toBe(false);
    expect(updatePersonSchema.safeParse({ register: "formel" }).success).toBe(true);
  });
});

/* Le genre sert l'ACCORD GRAMMATICAL, et rien d'autre — « fier » ou « fière ».
 * Son libellé à l'écran est « Genre », et c'est l'aide qui le qualifie :
 * « Pour que les messages soient écrits correctement. »
 *
 * Deux valeurs, parce que c'est ce que les deux écrans d'identité proposent
 * (§3.18, §3.23). La colonne en base en porte encore quatre ; le contrat les
 * refuse plutôt que de les migrer — ce que la base tolère et ce que le produit
 * accepte ne sont pas la même chose. */
describe("l'accord du message", () => {
  it("est obligatoire à la création d'un proche", () => {
    expect(createPersonSchema.safeParse({ displayName: "Célarine" }).success).toBe(false);
  });

  it("n'accepte que ce que les écrans proposent", () => {
    for (const g of ["female", "male"])
      expect(createPersonSchema.safeParse({ displayName: "C", gender: g }).success, g).toBe(true);
    for (const g of ["other", "unspecified", "", "autre"])
      expect(createPersonSchema.safeParse({ displayName: "C", gender: g }).success, g).toBe(false);
  });

  /* Il SE LIT, et il le faut : le formulaire d'identité porte un sélecteur,
     donc l'ouvrir pour corriger autre chose doit montrer ce qui a été répondu.
     L'en retirer ferait repartir le champ à vide à chaque modification. */
  it("est rendu au client, pour que le formulaire le montre", () => {
    expect(Object.keys(personSchema.shape)).toContain("gender");
  });

  // Nul pour une fiche antérieure à la règle : une absence de réponse est une
  // absence, pas une troisième réponse qu'un écran devrait savoir afficher.
  it("se rend nul quand la réponse manque", () => {
    expect(personSchema.shape.gender.safeParse(null).success).toBe(true);
  });

  /* Sur un COMPTE, il est facultatif — et pour une raison de parcours, pas par
     relâchement : une fiche naît d'un formulaire qui pose la question, un compte
     naît d'un code à usage unique qui ne pose rien. */
  it("reste facultatif sur un compte, dont l'inscription ne le demande pas", () => {
    expect(profileSchema.shape.gender.safeParse(null).success).toBe(true);
  });
});

