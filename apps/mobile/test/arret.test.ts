import { describe, expect, it } from "vitest";
import {
  DELAI_MINIMAL, delaiDAttente, estUnArret, exigeDeRelireLesDrapeaux,
} from "../lib/arret.js";

describe("reconnaître un arrêt", () => {
  /* `503` + code `maintenance`. Le distinguer d'un drapeau éteint est tout
     l'enjeu : un drapeau rend `404` et demande de masquer l'écran, un arrêt
     demande d'attendre. Confondre les deux ferait lire une fenêtre de deux
     heures comme une suppression définitive. */
  it("reconnaît le 503 de l'intervention", () => {
    expect(estUnArret(503, "maintenance")).toBe(true);
  });

  // Un 503 sans ce code vient d'ailleurs — une passerelle, un répartiteur. On
  // ne montre pas l'écran d'attente pour une panne qu'on ne sait pas nommer.
  it("ne prend pas tout 503 pour un arrêt", () => {
    expect(estUnArret(503, null)).toBe(false);
    expect(estUnArret(503, "internal_error")).toBe(false);
  });

  it("ne prend pas un drapeau éteint pour un arrêt", () => {
    expect(estUnArret(404, "not_found")).toBe(false);
  });
});

describe("le délai avant de réessayer", () => {
  /* Il vient du serveur, pour que tout le parc applique la même règle et qu'on
     puisse l'allonger si l'intervention dure. Le recalculer de son côté ferait
     revenir mille téléphones à la même seconde. */
  it("prend celui que le serveur annonce", () => {
    expect(delaiDAttente({ maintenance: true, retryAfterSeconds: 120 })).toBe(120);
  });

  // Sans délai annoncé, on attend quand même — mais peu, pour ne pas laisser
  // quelqu'un devant un écran figé si l'intervention s'achève tout de suite.
  it("retombe sur un plancher quand le serveur se tait", () => {
    expect(delaiDAttente({ maintenance: true, retryAfterSeconds: null })).toBe(DELAI_MINIMAL);
  });

  it("ne descend jamais sous le plancher", () => {
    expect(delaiDAttente({ maintenance: true, retryAfterSeconds: 1 })).toBe(DELAI_MINIMAL);
  });
});

describe("un 404 sur une surface gouvernée", () => {
  /* « Le recevoir là où vous attendiez une réponse veut dire relis la liste,
     pas affiche une erreur. » Le drapeau s'est éteint pendant la session : la
     liste est périmée, et c'est elle qu'il faut rafraîchir — montrer une erreur
     laisserait l'écran ouvert sur une surface qui n'existe plus. */
  it("demande de relire la liste", () => {
    expect(exigeDeRelireLesDrapeaux(404, "not_found")).toBe(true);
  });

  // Un 404 sur une ressource nommée est ordinaire — une note supprimée, un
  // proche effacé. Relire les drapeaux à chaque fois serait du bruit.
  it("ne s'applique qu'aux surfaces gouvernées", () => {
    expect(exigeDeRelireLesDrapeaux(404, "not_found", { gouvernee: false })).toBe(false);
  });

  it("ne s'applique à aucun autre statut", () => {
    expect(exigeDeRelireLesDrapeaux(403, "forbidden")).toBe(false);
    expect(exigeDeRelireLesDrapeaux(500, "internal_error")).toBe(false);
  });
});
