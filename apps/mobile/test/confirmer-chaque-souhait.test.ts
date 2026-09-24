import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/* « CONFIRM » GRISÉ SANS UN MOT — §21 du relevé des essais.
 *
 * La règle qui grise le bouton est juste : tout souhait doit être tranché,
 * sans quoi un souhait ignoré serait écarté par omission — le pire des
 * défauts sur cet écran. Mais rien ne le disait, pendant que « Set aside »,
 * global, restait actif : l'écran se lisait comme s'il ne permettait que de
 * refuser.
 *
 * `react-native` est typé en Flow, un test qui monterait l'écran ne
 * compilerait pas — cette garde lit donc la SOURCE, comme
 * `marquer-envoye.test.ts` et `voie-fermee.test.ts`.
 */
const valider = readFileSync(new URL("../app/valider.tsx", import.meta.url), "utf8");

describe("le bouton de confirmation", () => {
  it("dit ce qui manque quand un souhait n'est pas encore tranché", () => {
    expect(valider).toContain("!toutEstTranche(c.wishes, saisie.sorts)");
    expect(valider).toContain("t.validerTranchezTout");
  });

  /* La condition doit être EXACTE — `toutEstTranche`, pas `!pretAEnvoyer` :
     la seconde grossirait sans bruit si une autre raison de refuser
     apparaissait un jour, et le mot ne parlerait alors plus de la bonne
     cause. */
  it("ne s'accroche pas à la garde générale du bouton", () => {
    const bloc = valider.slice(
      valider.indexOf("§21 DU RELEVÉ DES ESSAIS"),
      valider.indexOf("<View style={styles.actions}>"),
    );
    expect(bloc).not.toContain("!pretAEnvoyer(c, saisie)");
  });
});
