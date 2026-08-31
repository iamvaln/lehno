import { describe, expect, it } from "vitest";
import { nativeTouchMin, resolve } from "@lehno/tokens";
import { styleDeCarteDEcheance } from "./EventCard.styles.js";

const CLAIR = resolve("light");
const SOMBRE = resolve("dark");

describe("la carte d'échéance", () => {
  /* La plus imminente porte un fond teinté et ses deux actions ; les suivantes
     restent des lignes calmes. Le fond teinté remplace le trait : les deux
     ensemble la feraient ressortir deux fois. */
  it("teinte la plus imminente et lui retire son trait", () => {
    for (const couleurs of [CLAIR, SOMBRE]) {
      const avant = styleDeCarteDEcheance({ couleurs, enAvant: true });
      expect(avant.enveloppe.backgroundColor).toBe(couleurs.surfacePanel);
      expect(avant.enveloppe.borderColor).toBe("transparent");
    }
  });

  it("laisse les suivantes en carte ordinaire, avec leur trait", () => {
    const s = styleDeCarteDEcheance({ couleurs: CLAIR });
    expect(s.enveloppe.backgroundColor).toBe(CLAIR.surfaceCard);
    expect(s.enveloppe.borderColor).toBe(CLAIR.borderObject);
  });

  // Une carte se touche : la ligne ne descend pas sous la cible tactile, même
  // quand le nom et l'occasion tiennent sur peu de hauteur.
  it("garde la ligne au-dessus de la cible tactile", () => {
    expect(styleDeCarteDEcheance({ couleurs: CLAIR }).ligne.minHeight).toBe(nativeTouchMin);
  });

  /* flexShrink, pas minWidth: 0 — qui n'existe pas en RN. C'est lui qui empêche
     un nom long de pousser le décompte hors de la carte. */
  it("laisse le texte se resserrer plutôt que chasser le décompte", () => {
    expect(styleDeCarteDEcheance({ couleurs: CLAIR }).texte.flexShrink).toBe(1);
    expect(styleDeCarteDEcheance({ couleurs: CLAIR }).texte).not.toHaveProperty("minWidth");
  });

  // Les actions n'existent que sur la carte mise en avant : « ce qui est rare
  // vit ailleurs ».
  it("n'ouvre la zone d'actions que sur la carte mise en avant", () => {
    expect(styleDeCarteDEcheance({ couleurs: CLAIR }).actions).toBeNull();
    expect(styleDeCarteDEcheance({ couleurs: CLAIR, enAvant: true }).actions).not.toBeNull();
  });
});
