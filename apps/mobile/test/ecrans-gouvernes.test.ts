import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CLES_DRAPEAUX } from "@lehno/contracts";

/* AUCUN ÉCRAN GOUVERNÉ NE S'OUVRE SANS SE GARDER LUI-MÊME.
 *
 * Une route `expo-router` s'atteint par LIEN PROFOND : la retirer de la
 * navigation ne la ferme pas. Un écran gouverné qu'on ouvre ainsi, drapeau
 * éteint, appelle une route que le serveur a fermée par `@Feature` — il reçoit
 * un 404 et l'affiche comme une panne. L'écran s'ouvre EN ROUGE sur un compte
 * parfaitement sain, et la personne croit le service cassé.
 *
 * C'est la même leçon que l'ouverture de lien : ce qui vient de la navigation
 * n'est pas une autorisation. La navigation cache ; elle ne garde pas.
 *
 * La table est ÉCRITE À LA MAIN, et c'est le but : un écran gouverné qui
 * arrive doit être inscrit ici, donc décidé. Une détection automatique le
 * laisserait passer en silence — précisément le cas qu'on veut rendre
 * impossible.
 */
const GOUVERNÉS: Readonly<Record<string, string>> = {
  // Les souhaits d'une liste passent par `/me/wishlists/:id/wishes` et
  // `/me/owner-wishes` : c'est `wishlist.own` qui les gouverne, pas `wishlist`
  // — celui-là ouvre la liste REÇUE d'un autre.
  souhaits: "listes",
  listes: "listes",
  monmur: "monmur",
  apercu: "monmur",
  valider: "valider",
  collecte: "collecte",
  parrainage: "parrainage",
  reservations: "reservations",
  paiement: "paiement",
  reprises: "reprises",
};

const source = (nom: string): string =>
  readFileSync(new URL(`../app/(app)/${nom}.tsx`, import.meta.url), "utf8");

describe("les écrans gouvernés se gardent eux-mêmes", () => {
  for (const [ecran, id] of Object.entries(GOUVERNÉS)) {
    it(`${ecran} refuse de s'ouvrir quand ${id} est éteint`, () => {
      const s = source(ecran);
      expect(s).toContain("ecranEteint(");
      // L'identifiant employé doit être celui que `navigation.ts` connaît :
      // un nom approchant passerait par le `default` et ne garderait rien.
      expect(s).toContain(`ecranEteint("${id}"`);
    });
  }

  /* LIRE LE VERDICT NE SUFFIT PAS, IL FAUT S'Y TENIR. Un écran qui calcule
     `eteint` et charge quand même part chercher sa route pendant qu'il affiche
     son état fermé : le 404 revient et se pose en bandeau par-dessus. La garde
     doit donc paraître dans une position de CONTRÔLE, pas seulement dans une
     affectation. */
  for (const ecran of Object.keys(GOUVERNÉS)) {
    it(`${ecran} agit sur son verdict, il ne se contente pas de le lire`, () => {
      expect(source(ecran)).toMatch(/if \(eteint\)|!eteint/);
    });
  }
});

/* Les identifiants de la table doivent exister dans `navigation.ts`, sans quoi
   la garde tombe dans le `default` — « tout le reste est du socle » — et ne
   garde rien du tout, silencieusement. */
describe("la table nomme des écrans que la navigation connaît", () => {
  it("n'invente aucun identifiant", () => {
    const nav = readFileSync(new URL("../lib/navigation.ts", import.meta.url), "utf8");
    const connus = new Set(
      [...nav.matchAll(/case "([a-z.]+)":/g)].map((m) => m[1]!),
    );
    const inconnus = [...new Set(Object.values(GOUVERNÉS))].filter((id) => !connus.has(id));
    expect(inconnus).toEqual([]);
  });

  /* Et les drapeaux qu'ils lisent doivent exister : le registre est la seule
     liste qui fasse foi, une clef approchante rendrait toujours faux. */
  it("ne lit que des drapeaux du registre", () => {
    const nav = readFileSync(new URL("../lib/navigation.ts", import.meta.url), "utf8");
    const lus = [...nav.matchAll(/ouvert\("([a-z.]+)"\)/g)].map((m) => m[1]!);
    expect(lus.filter((c) => !CLES_DRAPEAUX.includes(c as never))).toEqual([]);
  });
});
