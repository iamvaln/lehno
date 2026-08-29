import { describe, expect, it, vi } from "vitest";
import { unSeulALaFois } from "../lib/verrou.js";

describe("un seul essai à la fois", () => {
  /* Le cas qui a cassé en vrai : la fiche d'un proche lance deux appels
     ensemble. Passé un quart d'heure, tous deux expirent, et chacun demandait
     son renouvellement avec le MÊME jeton de rafraîchissement — que le serveur
     fait tourner. Le second passait pour un rejeu, et la session tombait. */
  it("ne lance qu'une demande pour plusieurs appelants simultanés", async () => {
    let resous: (v: string) => void = () => {};
    const fabrique = vi.fn(() => new Promise<string>((r) => { resous = r; }));
    const verrou = unSeulALaFois(fabrique);

    const a = verrou();
    const b = verrou();
    resous("neuf");

    expect(await a).toBe("neuf");
    expect(await b).toBe("neuf");
    expect(fabrique).toHaveBeenCalledTimes(1);
  });

  // Une fois finie, la suivante repart : le verrou sérialise, il ne met pas
  // en cache — sinon un jeton renouvelé une fois vaudrait pour toujours.
  it("relance après la fin de la précédente", async () => {
    const fabrique = vi.fn(() => Promise.resolve("neuf"));
    const verrou = unSeulALaFois(fabrique);
    await verrou();
    await verrou();
    expect(fabrique).toHaveBeenCalledTimes(2);
  });

  /* Le relâchement se fait sur un échec aussi. Garder le verrou pris aurait
     rendu le même refus à tous les appels suivants : une coupure de réseau
     d'une seconde aurait condamné la session jusqu'au redémarrage. */
  it("se relâche quand la demande échoue", async () => {
    const fabrique = vi.fn()
      .mockRejectedValueOnce(new Error("réseau"))
      .mockResolvedValueOnce("neuf");
    const verrou = unSeulALaFois(fabrique as () => Promise<string>);

    await expect(verrou()).rejects.toThrow("réseau");
    expect(await verrou()).toBe("neuf");
    expect(fabrique).toHaveBeenCalledTimes(2);
  });
});
