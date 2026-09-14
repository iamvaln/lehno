import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/* UNE CARTE QUI N'A QU'UN GESTE LE GARDE.
 *
 * `EventCard` n'affichait ses actions que si les DEUX libellés étaient là :
 * `prepareLabel` ET `markSentLabel`. Une carte qui n'avait qu'un geste à offrir
 * perdait donc aussi celui-là, sans un mot.
 *
 * Vu à l'appareil sur sa propre date : « Ma wishlist » sans « Marquer envoyé »,
 * puisqu'il n'y a rien à envoyer — la carte s'affichait muette. Le même défaut
 * valait quand la génération est éteinte, où l'écran veut que l'action « change
 * d'identité » pour devenir « Noter une idée » : elle disparaissait au lieu de
 * changer.
 *
 * AUCUN TEST NE LE VOYAIT, et c'est pour ça que cette garde lit la source : un
 * montage d'épreuve passe naturellement les deux libellés, donc il ne rencontre
 * jamais le cas. Seul l'appareil l'a montré.
 */
const carte = readFileSync(
  new URL("../../../packages/ui-native/src/content/EventCard.tsx", import.meta.url),
  "utf8",
);

describe("la carte d'échéance et ses gestes", () => {
  it("n'exige pas les deux libellés pour en afficher un", () => {
    expect(carte).not.toContain("prepareLabel && markSentLabel");
  });

  it("garde le premier geste derrière son propre libellé", () => {
    expect(carte).toContain("s.actions && prepareLabel ?");
  });

  it("rend le second facultatif, à l'intérieur du bloc", () => {
    const bloc = carte.slice(carte.indexOf("s.actions && prepareLabel ?"));
    expect(bloc).toContain("markSentLabel ? (");
  });
});
