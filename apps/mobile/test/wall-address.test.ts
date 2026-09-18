import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { wallAddress, wallAddressHint } from "../lib/wallAddress.js";

/* L'ADRESSE QU'ON DONNE POUR QU'UN AUTRE VOIE SON MUR.
 *
 * Elle était écrite dans le dictionnaire — `"lehno.io/" + pseudo` — et fausse
 * deux fois : elle nommait la PRODUCTION quel que soit le build, et il lui
 * manquait le segment `/m/`, donc elle ne pointait sur rien.
 *
 * Vu à l'écran le 17 septembre : un compte neuf de la sandbox lisait
 * « lehno.io/premiere », une adresse qui ne lui appartient pas.
 */
describe("l'adresse du mur", () => {
  const BASE = "https://sandbox.lehno.io";

  it("se compose sur l'adresse du serveur, avec le segment du mur", () => {
    expect(wallAddress(BASE, "premiere")).toBe("https://sandbox.lehno.io/m/premiere");
  });

  /* Le serveur normalise déjà, mais la barre finale d'une configuration mal
     saisie ferait `//m/`, que tout le monde ne traite pas pareil. */
  it("ne double pas la barre si la base en porte une", () => {
    expect(wallAddress("https://sandbox.lehno.io/", "premiere"))
      .toBe("https://sandbox.lehno.io/m/premiere");
  });

  /* RIEN PLUTÔT QU'UNE MOITIÉ. Tant que la configuration n'est pas revenue, on
     n'affiche pas d'adresse — c'est précisément d'une adresse devinée qu'on
     vient. */
  it("ne compose rien sans la base", () => {
    expect(wallAddress(null, "premiere")).toBeNull();
    expect(wallAddressHint(null, "premiere")).toBeUndefined();
  });

  // Le champ est vide pendant qu'on tape : « …/m/ » tout seul ne veut rien dire.
  it("ne compose rien sans pseudo", () => {
    expect(wallAddress(BASE, "")).toBeNull();
    expect(wallAddress(BASE, "   ")).toBeNull();
  });

  it("rogne les espaces autour du pseudo", () => {
    expect(wallAddress(BASE, "  premiere  ")).toBe("https://sandbox.lehno.io/m/premiere");
  });
});

/* AUCUN DOMAINE NE S'ÉCRIT DANS LE DICTIONNAIRE.
 *
 * C'est la forme qu'avait le défaut : une adresse de production figée dans un
 * libellé, invisible tant qu'on ne tournait pas sur un autre environnement. */
describe("les dictionnaires", () => {
  for (const langue of ["fr", "en"]) {
    it(`${langue} n'écrit aucun domaine en dur`, () => {
      const source = readFileSync(new URL(`../messages/${langue}.ts`, import.meta.url), "utf8");
      const trouves = [...source.matchAll(/"[^"]*lehno\.io[^"]*"/g)].map((m) => m[0]);
      expect(
        trouves,
        `l'adresse du site vient de /public/config, jamais d'un libellé : ${trouves.join(" · ")}`,
      ).toEqual([]);
    });
  }
});
