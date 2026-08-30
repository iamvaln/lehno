import { describe, expect, it } from "vitest";
import {
  cleDuCache, estGarde, estPerimee, PEREMPTION_MS, type Entree,
} from "../lib/cache.js";

describe("ce que le cache garde", () => {
  it("garde ce que la copie promet — les notes et les dates", () => {
    expect(estGarde("/me/home")).toBe(true);
    expect(estGarde("/me/persons?limit=100")).toBe(true);
    expect(estGarde("/me/persons/abc")).toBe(true);
    expect(estGarde("/me/persons/abc/notes")).toBe(true);
    expect(estGarde("/me/occurrences?from=2026-01-01&to=2026-02-01")).toBe(true);
  });

  /* NI SOLDE NI MONTANT. Un solde d'hier montré sans mention ferait décider
     d'un achat sur un chiffre faux, et l'argent est ce qu'on ne rattrape pas.
     C'est la seule catégorie que le cache refuse par principe. */
  it("ne garde jamais ce qui porte de l'argent", () => {
    expect(estGarde("/me/credits")).toBe(false);
    expect(estGarde("/me/payment-methods")).toBe(false);
    expect(estGarde("/me/credit-bundles")).toBe(false);
    expect(estGarde("/me/payments")).toBe(false);
  });

  /* LA LISTE EST NOMMÉE, PAS EXCLUSIVE. Une route neuve n'est pas gardée tant
     que personne ne l'a inscrite : le défaut est le silence, et il faut agir
     pour garder. Une liste d'exclusions ferait l'inverse — elle garderait la
     prochaine route ajoutée, sans que quiconque l'ait décidé. */
  it("ne garde pas une route qu'on n'a pas inscrite", () => {
    expect(estGarde("/me/balance")).toBe(false);
    expect(estGarde("/me/nouvelle-route")).toBe(false);
  });

  /* Une écriture n'a pas d'état à garder : garder sa réponse ferait rejouer un
     RÉSULTAT — « note créée » — là où on veut montrer une situation. */
  it("ne garde que les lectures", () => {
    expect(estGarde("/me/persons", "POST")).toBe(false);
    expect(estGarde("/me/persons/abc", "PATCH")).toBe(false);
    expect(estGarde("/me/persons/abc", "DELETE")).toBe(false);
    expect(estGarde("/me/home", "get")).toBe(true);
  });

  /* Un chemin qui COMMENCE comme un chemin gardé n'est pas gardé pour autant :
     `/me/personsXYZ` n'est pas `/me/persons`. Sans l'ancrage, une route voisine
     hériterait d'une décision qui ne la concerne pas. */
  it("ne confond pas un chemin voisin avec un chemin gardé", () => {
    expect(estGarde("/me/personsXYZ")).toBe(false);
    expect(estGarde("/me/homeland")).toBe(false);
    expect(estGarde("/me/profiles")).toBe(false);
  });
});

describe("la clé", () => {
  /* LA CHAÎNE DE REQUÊTE FAIT PARTIE DE LA QUESTION. Deux fenêtres de dates
     sont deux réponses ; les confondre montrerait les échéances d'un autre
     mois — et personne ne verrait l'erreur, puisque les deux sont plausibles. */
  it("distingue deux questions différentes sur le même chemin", () => {
    expect(cleDuCache("/me/occurrences?from=A")).not.toBe(cleDuCache("/me/occurrences?from=B"));
  });
});

describe("la péremption", () => {
  const le = (iso: string): Entree => ({ corps: "{}", enregistreLe: iso });
  const MIDI = Date.parse("2026-08-30T12:00:00.000Z");

  const ilYA = (ms: number): Entree => le(new Date(MIDI - ms).toISOString());

  it("garde ce qui tient dans la fenêtre, jusqu'au dernier instant", () => {
    expect(estPerimee(ilYA(24 * 60 * 60 * 1000), MIDI)).toBe(false);
    expect(estPerimee(ilYA(PEREMPTION_MS), MIDI)).toBe(false);
  });

  it("jette ce qui l'a dépassée", () => {
    expect(estPerimee(ilYA(PEREMPTION_MS + 1000), MIDI)).toBe(true);
  });

  /* CE QU'ON NE SAIT PAS DATER EST PÉRIMÉ. Le garder reviendrait à le garder
     pour toujours — et une entrée écrite par une version qui datait autrement
     resterait à l'écran des années. */
  it("jette ce qu'elle ne sait pas dater", () => {
    expect(estPerimee(le("pas une date"), MIDI)).toBe(true);
    expect(estPerimee(le(""), MIDI)).toBe(true);
  });
});
