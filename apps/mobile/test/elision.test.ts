import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/* AUCUN LIBELLÉ FRANÇAIS NE COLLE UN MOT ÉLIDABLE À UN PRÉNOM.
 *
 * « La wishlist de Awa ». Le dictionnaire concaténait « de » et le nom, et rien
 * nulle part n'élidait. Tous les prénoms à initiale vocalique rendaient la
 * phrase fautive — Awa, Élise, Ines, Omar, Ada —, y compris dans les DEUX
 * titres de pages publiques, celles qu'on envoie à ses proches.
 *
 * Six libellés étaient touchés. Le septième sera écrit par quelqu'un qui n'aura
 * pas lu ce fichier : cette garde balaie donc la source plutôt que d'énumérer
 * les cas connus.
 *
 * ELLE NE REGARDE QUE LE FRANÇAIS. L'anglais dit « Awa's wishlist » et n'a pas
 * cette règle ; l'y chercher ferait tomber le test sur une langue qui va bien.
 */

/* Les mots qui s'élident devant une voyelle. « comme », « avec », « pour » n'en
   sont pas — les chercher ferait refuser « connecté comme Awa », qui est juste. */
const ELIDABLES = ["de", "que", "le", "la", "ce", "ne", "se", "me", "te", "je"];

const source = readFileSync(new URL("../messages/fr.ts", import.meta.url), "utf8");

/* Un libellé qui colle un mot élidable à une interpolation : `"… de " + qui`.
   On ne regarde que les fonctions du dictionnaire — le texte fixe, lui, a déjà
   son élision écrite à la main. */
const colle = new RegExp(`"[^"]*\\\\b(${ELIDABLES.join("|")}) " \\\\+ [a-z]`, "g");

describe("les libellés français qui nomment quelqu'un", () => {
  it("n'en colle aucun à un prénom", () => {
    const fautifs = [...source.matchAll(colle)].map((m) => m[0]);
    expect(
      fautifs,
      `à corriger par elideBefore() : ${fautifs.join(" · ")}`,
    ).toEqual([]);
  });

  // Sans ça, une expression rationnelle cassée rendrait le test vert à vide.
  it("regarde bien un dictionnaire qui interpole des noms", () => {
    expect(/=> "[^"]*" \+ [a-z]/.test(source)).toBe(true);
  });
});
