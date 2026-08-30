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

  /* DEUX GARDES, ET IL EN FAUT DEUX.
   *
   * Une seule ne suffit pas, et je l'ai éprouvé : la première version de ce
   * test acceptait l'une OU l'autre, et retirer la garde de RENDU la laissait
   * passer sans un mot — l'écran s'ouvrait entier, vide, avec ses boutons.
   *
   * La garde de CHARGEMENT empêche la requête : sans elle, le 404 revient se
   * poser en bandeau par-dessus l'état fermé.
   *
   * La garde de RENDU empêche l'écran : sans elle, on voit la coquille d'une
   * fonctionnalité qui n'existe pas, avec des gestes qui échoueront tous.
   *
   * Elles ne se remplacent pas, chacune ferme ce que l'autre laisse ouvert. */
  for (const ecran of Object.keys(GOUVERNÉS)) {
    it(`${ecran} refuse de charger tant qu'il est éteint`, () => {
      /* DEUX FORMES ACCEPTÉES, parce qu'elles ferment la même porte.
       *
       * Soit l'EFFET n'appelle pas — `if (!eteint) void charge()` ; soit la
       * FONCTION qui charge sort d'elle-même avant son premier appel. La
       * seconde est la meilleure : elle couvre aussi le tirer-pour-rafraîchir
       * et le rechargement au retour sur l'écran, que l'effet ne voit pas. Le
       * test ne l'impose pas, mais il ne doit pas la refuser.
       *
       * On ne se contente PAS de chercher `eteint` avant le premier `appel<`
       * dans le fichier : l'ordre du TEXTE n'est pas l'ordre de l'EXÉCUTION —
       * la fonction de chargement est déclarée avant l'effet qui la garde, et
       * ce test-là passait pour de mauvaises raisons.
       */
      const s = source(ecran);
      const parEffet = /use(?:Focus)?Effect\([^;]*!eteint/.test(s);
      const debut = s.indexOf("useCallback(async () => {");
      const parLaFonction = debut > -1
        && /^\s*(?:\/\*[\s\S]*?\*\/\s*)?if \(eteint\)/.test(
          s.slice(debut + "useCallback(async () => {".length),
        );
      expect(parEffet || parLaFonction).toBe(true);
    });

    it(`${ecran} refuse de se rendre tant qu'il est éteint`, () => {
      expect(source(ecran)).toContain("if (eteint) return <EcranFerme />;");
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
