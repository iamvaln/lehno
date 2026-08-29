import { describe, expect, it } from "vitest";
import { nativeBorder, resolve } from "@lehno/tokens";
import {
  ACTIONS_PAYANTES, actionPrincipale, soldeSuffisant, styleDeFeuillePayante,
} from "./PaidActionSheet.styles.js";

const CLAIR = resolve("light");
const SOMBRE = resolve("dark");

describe("ce que la feuille payante décide", () => {
  /* LE DERNIER CRÉDIT. `solde > cout` gèle sur le compte le crédit qu'on est
     venu dépenser : avec 1 crédit et un portrait à 1, la feuille envoie
     recharger quelqu'un qui pouvait payer. Le test tient la borne des deux
     côtés, et pour plusieurs coûts — l'égalité est le seul cas où la faute se
     voit, et c'est le cas le plus fréquent d'un compte qui se vide. */
  it("laisse dépenser le dernier crédit", () => {
    for (const cout of [1, 2, 3, 9]) {
      expect(soldeSuffisant({ cout, solde: cout }), `${cout}/${cout}`).toBe(true);
      expect(soldeSuffisant({ cout, solde: cout - 1 }), `${cout}/${cout - 1}`).toBe(false);
      expect(soldeSuffisant({ cout, solde: cout + 1 }), `${cout}/${cout + 1}`).toBe(true);
    }
  });

  /* UN COÛT NUL. Une action offerte — la première génération, un geste de
     bienvenue — s'annonce par la même feuille. Envoyer recharger un compte
     vide pour une action gratuite serait absurde, et refuserait un cadeau. */
  it("lance une action gratuite, même sur un compte vide", () => {
    expect(soldeSuffisant({ cout: 0, solde: 0 })).toBe(true);
    expect(actionPrincipale({ cout: 0, solde: 0 })).toBe("lancer");
  });

  /* Une seule action principale, et jamais celle qui échouerait. Le test
     balaie la grille plutôt qu'un cas : ce qui doit tenir, c'est qu'aucun
     couple (coût, solde) ne fasse paraître « Lancer » sur une génération que
     la feuille sait impayable. */
  it("ne propose jamais de lancer ce qui ne peut pas se payer", () => {
    for (let cout = 0; cout <= 5; cout += 1) {
      for (let solde = 0; solde <= 5; solde += 1) {
        const action = actionPrincipale({ cout, solde });
        expect(ACTIONS_PAYANTES, `${cout}/${solde}`).toContain(action);
        if (action === "lancer") expect(solde, `${cout}/${solde}`).toBeGreaterThanOrEqual(cout);
        else expect(solde, `${cout}/${solde}`).toBeLessThan(cout);
      }
    }
  });

  /* Sans solde connu, la feuille se tait plutôt que de lancer : le défaut est
     « Recharger », qui ne dépense rien. L'inverse ferait partir une génération
     dont personne ne sait si elle est payée. */
  it("se retient quand elle ne connaît pas le solde", () => {
    expect(actionPrincipale()).toBe("recharger");
    expect(actionPrincipale({ cout: 1 })).toBe("recharger");
  });

  /* LE DÉFAUT QUI INVENTAIT UN PRIX. Le coût valait `1` faute de mieux : un
     solde de 1 « suffisait » alors pour une action dont personne n'avait servi
     le tarif, et la feuille proposait de lancer. Le tarif se règle en
     administration sans livraison — le deviner, c'est annoncer l'ancien.

     Un coût inconnu ne suffit désormais jamais, même à quelqu'un qui a de
     quoi : mieux vaut renvoyer vers la recharge que débiter un prix supposé. */
  it("ne lance rien quand le coût n'est pas servi, si riche soit-on", () => {
    expect(actionPrincipale({ solde: 999 })).toBe("recharger");
    expect(soldeSuffisant({ solde: 999 })).toBe(false);
  });

  // Un solde négatif — un remboursement repris, un ajustement — ne doit jamais
  // ouvrir la génération.
  it("ne lance rien sur un solde négatif", () => {
    expect(actionPrincipale({ cout: 1, solde: -3 })).toBe("recharger");
  });
});

describe("le style de la feuille payante", () => {
  /* Le coût se sépare par un filet, jamais par un encadré : ce produit n'a pas
     d'ombre, et une boîte autour du prix en ferait une offre commerciale. */
  it("détache le coût par un filet de la charte, dans les deux thèmes", () => {
    for (const couleurs of [CLAIR, SOMBRE]) {
      const s = styleDeFeuillePayante(couleurs);
      expect(s.ligneDuCout.borderTopWidth).toBe(nativeBorder.width);
      expect(s.ligneDuCout.borderTopColor).toBe(couleurs.borderHairline);
      expect(s.ligneDuCout).not.toHaveProperty("borderWidth");
      expect(s.ligneDuCout).not.toHaveProperty("backgroundColor");
    }
  });

  // Le coût et le solde se lisent sur la même ligne, aux deux bouts : c'est ce
  // qui permet de comparer d'un coup d'œil sans lire deux phrases.
  it("pose le coût et le solde aux deux bouts d'une même ligne", () => {
    const s = styleDeFeuillePayante(CLAIR);
    expect(s.ligneDuCout.flexDirection).toBe("row");
    expect(s.ligneDuCout.justifyContent).toBe("space-between");
  });
});
