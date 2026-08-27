import { describe, expect, it } from "vitest";
import {
  DELAI_MINIMAL, SECONDES_POUR_ANNONCER_UNE_HEURE, delaiDAttente, estUnArret,
  exigeDeRelireLesDrapeaux, exigeDeRelireLesMetadonnees, heureDeRetour,
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

describe("l'heure de retour", () => {
  const MIDI = Date.UTC(2026, 7, 26, 12, 0, 0);

  /* Elle se CALCULE depuis le délai du serveur. Le kit donnait « 14 h 30 » en
     exemple ; l'afficher tel quel annonçait une heure inventée, et quelqu'un
     serait revenu à 14 h 30 pour trouver la même page. */
  it("suit le délai annoncé, pas un exemple", () => {
    const dans2h = heureDeRetour(2 * 3600, MIDI, "fr");
    const dans3h = heureDeRetour(3 * 3600, MIDI, "fr");
    expect(dans2h).not.toBeNull();
    expect(dans2h).not.toEqual(dans3h);
  });

  /* Sous un quart d'heure, on ne donne pas d'heure : « de retour vers 12 h 01 »
     quand il reste quarante secondes se lit comme une panne, pas comme une
     minute à patienter. L'écran dit alors seulement qu'une mise à jour est en
     cours. */
  it("se tait quand l'attente est courte", () => {
    expect(heureDeRetour(45, MIDI, "fr")).toBeNull();
    expect(heureDeRetour(SECONDES_POUR_ANNONCER_UNE_HEURE - 1, MIDI, "fr")).toBeNull();
    expect(heureDeRetour(SECONDES_POUR_ANNONCER_UNE_HEURE, MIDI, "fr")).not.toBeNull();
  });

  it("ne dit rien sans délai du tout", () => {
    expect(heureDeRetour(null, MIDI, "fr")).toBeNull();
  });
});

describe("le filet des choix fermés", () => {
  /* `422 resource_inactive`, pas `404` : le chemin existe, les anniversaires
     l'empruntent. Une surface fermée par un drapeau rend `404` et se masque ;
     un CHOIX fermé dans une surface ouverte rend `422` et se relit. */
  it("se distingue d'une surface fermée", () => {
    expect(exigeDeRelireLesMetadonnees(422, "resource_inactive")).toBe(true);
    expect(exigeDeRelireLesMetadonnees(404, "not_found")).toBe(false);
  });

  // Un autre 422 est une vraie erreur de saisie, qui se montre : une date de
  // naissance manquante, un pseudo déjà pris.
  it("ne confond pas avec une saisie refusée", () => {
    expect(exigeDeRelireLesMetadonnees(422, "validation_failed")).toBe(false);
  });
});
