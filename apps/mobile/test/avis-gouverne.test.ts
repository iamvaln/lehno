import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/* UN AVIS QUI NE SE RELIT PAS EST UN AVIS QU'ON CESSE DE DONNER.
 *
 * Le serveur accepte un pouce sur les trois natures — `PATCH …/feedback` — mais
 * seules les IDÉES le rendent en lecture : `portraitSchema` et
 * `generatedMessageSchema` ne portent pas le champ. Un pouce posé sur un
 * portrait disparaît donc à la réouverture de l'écran, et le geste suivant
 * réécrit la même valeur en croyant la changer.
 *
 * Cette garde existe pour que le jour où le champ arrive au contrat, quelqu'un
 * le voie : elle tombe, on retire la nature de la table, et on câble le pouce.
 * Sans elle, le manque resterait une note dans un brief que personne ne relit.
 */
const contrat = readFileSync(
  new URL("../../../packages/contracts/src/me-generation.ts", import.meta.url),
  "utf8",
);

/** Les champs d'un schéma nommé, tels que le contrat les déclare. */
const champsDe = (schema: string): string => {
  const debut = contrat.indexOf(`export const ${schema} = z.object(`);
  if (debut === -1) throw new Error(`schéma introuvable : ${schema}`);
  const fin = contrat.indexOf("}).strict()", debut);
  return contrat.slice(debut, fin);
};

describe("le pouce, et ce que le contrat en relit", () => {
  it("les idées le rendent — c'est la nature qui le portait la première", () => {
    expect(champsDe("generatedIdeaSchema")).toContain("feedback:");
  });

  /* CES DEUX-LÀ SONT LE MANQUE, et le test le dit dans ce sens : il tombera le
     jour où on le comble, ce qui est exactement quand on veut être prévenu. */
  it("le portrait ne le rend PAS — à retirer d'ici quand il le rendra", () => {
    expect(champsDe("portraitSchema")).not.toContain("feedback:");
  });

  it("le message ne le rend PAS — à retirer d'ici quand il le rendra", () => {
    expect(champsDe("generatedMessageSchema")).not.toContain("feedback:");
  });
});
