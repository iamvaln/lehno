import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { NATURES_AVIS } from "@lehno/contracts";

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

  /* CES DEUX-LÀ ÉTAIENT LE MANQUE, et le test le disait dans ce sens : « à
     retirer d'ici quand il le rendra ». Il a tombé le 13 septembre, ce qui est
     exactement quand on voulait être prévenu. Retourné plutôt que supprimé :
     l'invariant est le même, dans l'autre sens — les trois natures rendent
     l'avis, et l'une qui cesserait de le faire doit se voir. */
  it("le portrait le rend aussi, depuis le 13", () => {
    expect(champsDe("portraitSchema")).toContain("feedback:");
  });

  it("le message le rend aussi, depuis le 13", () => {
    expect(champsDe("generatedMessageSchema")).toContain("feedback:");
  });

  /* LE MOTIF ET LA NOTE SUIVENT L'AVIS PARTOUT. Sans eux, rouvrir une
     production ne dirait plus ce qu'on avait répondu, et la question se
     reposerait comme si on n'avait rien dit. */
  it("les trois rendent aussi le motif et la note", () => {
    for (const schema of ["portraitSchema", "generatedMessageSchema", "generatedIdeaSchema"]) {
      expect(champsDe(schema)).toContain("feedbackReasonCode:");
      expect(champsDe(schema)).toContain("feedbackNote:");
    }
  });

  /* UN REJET PORTE UN MOTIF, et c'est le serveur qui l'exige — l'écran doit
     donc enchaîner sur une question après un pouce en bas. Le contrat le dit,
     et ce test tombera si quelqu'un relâche la règle en croyant simplifier. */
  it("le corps d'un avis exige un motif sur un rejet", () => {
    expect(champsDe("avisSchema")).toContain("reasonCode:");
    expect(contrat).toContain("un rejet demande un motif");
  });
});

/* LES TROIS NATURES PORTENT L'AVIS À L'ÉCRAN, et cette garde lit la source.
 *
 * `NATURES_AVIS` est au contrat — c'est lui qui dit combien il y en a. Une
 * quatrième qui arriverait sans que personne ne pose son pouce ne ferait rien
 * tomber : l'écran marcherait, il ne demanderait simplement jamais l'avis, et
 * le comptage sortirait vide sans qu'on sache pourquoi.
 *
 * On vérifie la NATURE PASSÉE au composant, pas sa présence : `<Avis` sans
 * `nature="message"` ne prouve rien sur le message.
 */
describe("les trois natures demandent un avis", () => {
  const sources = ["app/generation.tsx", "app/portrait.tsx"]
    .map((n) => readFileSync(new URL(`../${n}`, import.meta.url), "utf8"))
    .join("\n");

  for (const nature of NATURES_AVIS) {
    it(`la nature « ${nature} » pose son avis à l'écran`, () => {
      expect(sources).toContain(`nature="${nature}"`);
    });
  }

  /* LA SONDE : la garde doit distinguer une nature posée d'une simple mention. */
  it("ne se contente pas du mot", () => {
    expect('<Avis nature="portrait"').toContain('nature="portrait"');
    expect("/* le portrait porte un avis */").not.toContain('nature="portrait"');
  });
});
