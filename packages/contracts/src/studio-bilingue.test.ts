import { describe, expect, it } from "vitest";
import { orientationReglageSchema } from "./studio.js";

/* UN BILINGUE EST ENTIER OU NUL — et sa clé n'est jamais facultative.
 *
 * Le schéma s'appelait `bilingueFacultatifSchema`, et le nom disait le contraire
 * de ce qu'il fait : c'est `.nullable()`, pas `.optional()`. Un client écrit sur
 * la foi de ce nom aurait sauté la clé, et l'orientation entière aurait été
 * refusée sur un message parlant d'un mauvais TYPE — qui n'aide pas celui qui a
 * simplement oublié la clé.
 *
 * Ces cas fixent le comportement plutôt que le nom : c'est lui que les écrans
 * doivent tenir, et il a déjà coûté trois séances à réapprendre. */
describe("un bilingue facultatif ne l'est pas", () => {
  const socle = {
    id: "notre_relation", actif: true,
    libelle: { fr: "Notre relation", en: "Our bond" },
    consigne: { fr: "Parle du lien", en: "Speak of the bond" },
    avertissement: null,
  };

  it("exige la CLÉ, même pour dire nul", () => {
    // `description` absente — pas nulle, absente.
    const sans = orientationReglageSchema.safeParse(socle);
    expect(sans.success).toBe(false);
    expect(sans.success === false && sans.error.issues[0]?.path).toEqual(["description"]);
  });

  it("accepte le nul", () => {
    expect(orientationReglageSchema.safeParse({ ...socle, description: null }).success).toBe(true);
  });

  it("accepte les deux côtés", () => {
    expect(orientationReglageSchema.safeParse({
      ...socle, description: { fr: "ce qui la distingue", en: "what sets it apart" },
    }).success).toBe(true);
  });

  /* PAS DE DEMI-MESURE, et c'est ce que les écrans doivent dire AVANT d'envoyer :
     un côté vide est refusé comme un côté manquant. Sans ce contrôle à l'écran,
     l'administrateur remplit le français, enregistre, et le refus tombe après
     l'aller-retour sans nommer l'orientation fautive. */
  it.each([
    ["un côté manquant", { fr: "seulement le français" }],
    ["un côté vide", { fr: "seulement le français", en: "" }],
    ["un côté d'espaces", { fr: "seulement le français", en: "   " }],
  ])("refuse %s", (_nom, description) => {
    const r = orientationReglageSchema.safeParse({ ...socle, description });
    expect(r.success).toBe(false);
    expect(r.success === false && r.error.issues[0]?.path).toEqual(["description", "en"]);
  });
});
