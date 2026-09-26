import { describe, expect, it } from "vitest";
import { en } from "../messages/en.js";
import { fr } from "../messages/fr.js";

/* LE BOUTON DIT LA SUITE, PAS LA SIGNATURE — §25 (écart 1) du relevé des
 * essais. `specs/design-portrait-mobile-2026-09-11.md` §1.2 écarte
 * nommément « Approuver » : il se lit comme un engagement administratif,
 * quand le geste vérifie le texte ET lance la composition de l'image — pour
 * les trois voies (illustration, photo, motif de marque). Le remplaçant
 * qu'elle donne est littéral : « Composer l'image ».
 *
 * L'en-tête tombe sous la même critique : il nommait un état administratif
 * (« à valider ») plutôt que le geste qui reste à faire.
 */
describe("le portrait ne demande plus d'approbation", () => {
  it("le geste se nomme « composer », pas « approuver »", () => {
    expect(fr.portraitApprouver).toBe("Composer l'image");
    expect(en.portraitApprouver).toBe("Compose the image");
  });

  it("l'en-tête annonce le geste qui reste à faire, pas un état administratif", () => {
    expect(fr.portraitAValider.toLowerCase()).not.toContain("valider");
    expect(en.portraitAValider.toLowerCase()).not.toContain("approve");
  });
});
