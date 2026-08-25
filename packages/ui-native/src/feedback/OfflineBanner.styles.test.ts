import { describe, expect, it } from "vitest";
import { resolve } from "@lehno/tokens";
import { styleDeBandeauHorsLigne } from "./OfflineBanner.styles.js";

const CLAIR = resolve("light");

describe("le bandeau hors connexion", () => {
  /* Ce n'est pas une erreur : rien n'est cassé, et la consultation continue.
     Le poser en rouge ferait croire à une panne du produit là où c'est le
     réseau qui manque. Il prend donc la surface calme, comme le moment grave. */
  it("reste calme, sans couleur d'alerte", () => {
    const s = styleDeBandeauHorsLigne(CLAIR);
    expect(s.conteneur.backgroundColor).toBe(CLAIR.surfacePanel);
    expect(s.texte.color).toBe(CLAIR.textBody);
    expect(s.couleurIcone).toBe(CLAIR.textSecondary);
  });

  it("traverse la page comme les autres bandeaux", () => {
    expect(styleDeBandeauHorsLigne(CLAIR).conteneur.borderRadius).toBe(0);
  });
});
