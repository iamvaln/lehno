import { describe, expect, it } from "vitest";
import { rangsDuBouton } from "../core/Button.styles.js";
import { resolve } from "@lehno/tokens";
import { actionsDeConfirmation } from "./ConfirmSheet.styles.js";

const CLAIR = resolve("light");

describe("les actions de la feuille de confirmation", () => {
  /* LE DÉFAUT QU'ON NE VOIT QU'UNE FOIS. Deux boutons de même poids, l'un
     au-dessus de l'autre, et c'est ainsi qu'on supprime un proche en visant
     « Annuler ». Le refus reste donc au rang `text` — sans fond ni contour —
     quelle que soit la gravité de la question.

     Le test le vérifie pour les deux gravités, et par la charte plutôt que par
     le nom du rang : ce qui compte, c'est que le refus n'ait pas de surface. */
  it("ne donne jamais au refus la surface de l'accord", () => {
    for (const destructif of [false, true]) {
      const a = actionsDeConfirmation({ destructif });
      const rangs = rangsDuBouton(CLAIR);
      expect(a.rangDuRefus, String(destructif)).not.toBe(a.rang);
      expect(rangs[a.rangDuRefus].fond, String(destructif)).toBe("transparent");
      expect(rangs[a.rangDuRefus].bord, String(destructif)).toBe("transparent");
      expect(rangs[a.rang].fond, String(destructif)).not.toBe("transparent");
    }
  });

  // La gravité de la question se lit dans le rang de l'accord, pas dans un
  // réglage à part : une feuille destructive ne peut pas porter un accord
  // ordinaire, et l'inverse non plus.
  it("fait porter la gravité par l'accord", () => {
    expect(actionsDeConfirmation({ destructif: true }).rang).toBe("destructive");
    expect(actionsDeConfirmation({ destructif: false }).rang).toBe("primary");
    expect(actionsDeConfirmation().rang).toBe("primary");
  });

  /* La corbeille n'accompagne que l'accord destructeur. Sur une question
     ordinaire — « Envoyer ce portrait ? » — elle dramatiserait un geste qui ne
     défait rien. */
  it("ne pose de signe que sur l'accord qui détruit", () => {
    expect(actionsDeConfirmation({ destructif: true }).signe).toBe("trash-2");
    expect(actionsDeConfirmation({ destructif: false }).signe).toBeNull();
  });
});
