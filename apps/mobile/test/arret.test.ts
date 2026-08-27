import { describe, expect, it } from "vitest";
import {
  DELAI_MINIMAL, delaiDAttente, estUnArret,
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
    expect(delaiDAttente(120 )).toBe(120);
  });

  // Sans délai annoncé, on attend quand même — mais peu, pour ne pas laisser
  // quelqu'un devant un écran figé si l'intervention s'achève tout de suite.
  it("retombe sur un plancher quand le serveur se tait", () => {
    expect(delaiDAttente(null )).toBe(DELAI_MINIMAL);
  });

  it("ne descend jamais sous le plancher", () => {
    expect(delaiDAttente(1 )).toBe(DELAI_MINIMAL);
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
  /* Elle vient de `until`, PAS de `retryAfterSeconds`. Je dérivais l'une de
     l'autre ; le contrat le corrige : le rythme de réessai n'annonce pas un
     retour. Un rythme de quinze minutes ne dit pas que le service revient
     dans quinze minutes. */
  it("se lit dans l'heure annoncée", () => {
    const midi = heureDeRetour("2026-08-27T12:00:00Z", "fr");
    const quatorze = heureDeRetour("2026-08-27T14:00:00Z", "fr");
    expect(midi).not.toBeNull();
    expect(midi).not.toEqual(quatorze);
  });

  /* Facultative : on ne connaît pas toujours l'heure de retour. L'écran a
     alors raison de dire seulement qu'une mise à jour est en cours — pas de
     « bientôt », pas d'estimation inventée. */
  it("ne dit rien quand le serveur ne l'annonce pas", () => {
    expect(heureDeRetour(null, "fr")).toBeNull();
  });

  // Une chaîne illisible ne rend rien : mieux vaut se taire qu'afficher
  // « Invalid Date » à quelqu'un qui attend.
  it("se tait sur un horodatage illisible", () => {
    expect(heureDeRetour("bientôt", "fr")).toBeNull();
  });

  // L'heure se dit dans la langue de lecture, et à l'heure du téléphone : le
  // serveur envoie de l'UTC, il ne connaît pas le fuseau du demandeur.
  it("se dit dans la langue de lecture", () => {
    expect(heureDeRetour("2026-08-27T12:00:00Z", "fr"))
      .not.toEqual(heureDeRetour("2026-08-27T12:00:00Z", "en"));
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
