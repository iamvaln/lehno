import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/* DEUX GARDES SUR LE PARCOURS DE GÉNÉRATION, et toutes deux lisent la SOURCE.
 *
 * Les deux défauts qu'elles gèlent n'étaient visibles qu'à l'appareil : l'un
 * vit dans une navigation, l'autre dans une branche de rendu. Un montage
 * d'épreuve ne rencontre ni l'une ni l'autre — `lib/reprises.ts` est éprouvé de
 * part en part et n'a jamais rien vu, parce que la décision fautive était dans
 * l'écran, pas dans la bibliothèque.
 */

const lire = (chemin: string): string =>
  readFileSync(new URL(chemin, import.meta.url), "utf8");

const preparation = lire("../app/(app)/preparation.tsx");
const reprises = lire("../app/(app)/reprises.tsx");

/* ─────────────────────────────────────────────────────────────────────────
 * « ON ARRIVE SUR LA CHOSE, JAMAIS SUR UNE LISTE »
 *
 * Le lancement jetait la réponse du serveur — qui porte pourtant l'identifiant
 * de l'exécution créée — et poussait vers l'écran de LISTE. L'écran d'attente
 * ne s'ouvrait donc jamais : ni progression, ni résultat, ni motif d'échec.
 *
 * Vu à l'appareil : on demande un message, on atterrit sur « En cours » où
 * figure un portrait sans rapport, avec « Reprendre » pour seul geste.
 * ───────────────────────────────────────────────────────────────────────── */
describe("le lancement d'une génération", () => {
  it("ne pousse plus vers la liste des reprises", () => {
    expect(preparation).not.toContain('routeur.push("/(app)/reprises")');
  });

  it("lit l'identifiant rendu par le serveur plutôt que de jeter la réponse", () => {
    expect(preparation).toContain("generationResultSchema.parse(await appel");
  });

  it("ouvre l'exécution, et la REMPLACE pour qu'un retour ne relance pas", () => {
    expect(preparation).toContain('routeur.replace({ pathname: "/generation"');
    expect(preparation).toContain("params: { id: lu.generation.id }");
  });
});

/* ─────────────────────────────────────────────────────────────────────────
 * CE QUI TRAVAILLE SE LIT DANS L'ÉTAT, PAS DANS L'ABSENCE DE DATE
 *
 * La mention de la carte disait « Lehno écrit » dès que `jours` était nul. Le
 * motif valait pour un message dont l'occasion tombe hors de la fenêtre lue —
 * mais un PORTRAIT vise un proche, jamais une occasion : `jours` y est nul par
 * construction.
 *
 * Tout portrait se disait donc en cours POUR TOUJOURS, même produit et rendu.
 * L'accueil comptait une reprise qui n'attendait rien, et l'on proposait
 * « Reprendre » sur un travail fini.
 * ───────────────────────────────────────────────────────────────────────── */
describe("la mention de la carte de reprise", () => {
  it("se décide sur l'état de l'exécution", () => {
    expect(reprises).toContain("{reprise.enCours ? (");
  });

  it("ne déduit plus « en cours » d'une échéance absente", () => {
    expect(reprises).not.toContain("{reprise.jours === null ? (\n          <Text");
  });

  it("ne montre rien plutôt que d'inventer, quand il n'y a ni date ni travail", () => {
    expect(reprises).toContain("reprise.jours === null ? null");
  });
});
