import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

/* CE QUI S'ÉCRIT SUR LE TÉLÉPHONE DOIT S'EFFACER AVEC LA SESSION.
 *
 * Le cache porte des noms, des dates de naissance et des notes intimes ; la
 * file porte le texte des notes qu'on vient d'écrire. Un compte quitté sur un
 * téléphone prêté ne doit rien laisser derrière lui, et un second compte ouvert
 * sur le même appareil ne doit pas voir le carnet du premier.
 *
 * LE PIÈGE EST QU'UN OUBLI NE CASSE RIEN. Un troisième magasin ajouté demain —
 * des brouillons, une file d'envoi d'images — fonctionnerait parfaitement et ne
 * s'effacerait jamais. Aucun test ne tomberait, aucun écran ne broncherait, et
 * les données resteraient. C'est la même classe que la sauvegarde Android
 * laissée ouverte : ce qui réussit silencieusement ne se voit pas.
 *
 * Ce test lie donc les deux bouts : tout module qui ÉCRIT dans le stockage
 * local doit exposer un vidage, et ce vidage doit être appelé là où la session
 * se termine.
 */
const lib = (nom: string): string =>
  readFileSync(new URL(`../lib/${nom}`, import.meta.url), "utf8");

/* `effaceLesJetons` est LE point de sortie, et c'est pourquoi le vidage y vit :
   ce chemin couvre les quatre départs — la déconnexion voulue, la fermeture du
   compte, la session invalidée par le serveur, et le renouvellement qui échoue.
   Posé dans un écran, il manquerait les deux derniers, ceux qu'on ne choisit
   pas. */
const SORTIE = "lib/jetons.ts";

describe("ce qui s'écrit localement s'efface au départ", () => {
  /* On repère les écrivains par leur import du magasin plutôt que par une
     liste : une liste tenue à la main oublierait le module qu'on vient
     d'ajouter, et c'est précisément lui le risque. */
  const ecrivains = readdirSync(new URL("../lib/", import.meta.url))
    .filter((f) => f.endsWith(".ts") || f.endsWith(".tsx"))
    .filter((f) => /from "expo-sqlite\/kv-store"/.test(lib(f)));

  it("trouve les modules qui écrivent sur le téléphone", () => {
    // Si ce test tombe, c'est que le magasin a changé de nom : la détection
    // ci-dessus ne trouve plus personne et TOUTES les gardes qui suivent
    // deviennent vides sans échouer.
    expect(ecrivains.length).toBeGreaterThan(0);
  });

  for (const f of ecrivains) {
    it(`${f} expose un vidage`, () => {
      expect(lib(f)).toMatch(/export async function vide[A-Za-z]+\(/);
    });

    it(`le vidage de ${f} est appelé à la fin de session`, () => {
      const nom = /export async function (vide[A-Za-z]+)\(/.exec(lib(f))?.[1];
      expect(nom).toBeDefined();
      const sortie = readFileSync(new URL(`../${SORTIE}`, import.meta.url), "utf8");
      expect(sortie).toContain(`${nom!}()`);
    });
  }
});
