import { describe, expect, it } from "vitest";
import type { Home, Occurrence } from "@lehno/contracts";
import {
  MAX_CARTES, MAX_RANGS, MIN_CARTES, REMPLISSAGE_PLEIN, SEUIL_DE_REDIMENSIONNEMENT,
  composeLAccueil, doitRepartirDuMaximum, etatDeLAccueil, retrecit,
} from "../lib/accueil.js";

function echeance(jours: number, n = jours): Occurrence {
  return {
    id: `1111111${n}-1111-4111-8111-111111111111`,
    eventId: "22222222-2222-4222-8222-222222222222",
    personId: "33333333-3333-4333-8333-333333333333",
    personDisplayName: `Proche ${n}`, kind: "birthday", nature: "happy",
    label: null, occurrenceDate: "2026-09-01", occurrenceYear: 2026,
    status: "upcoming", daysUntil: jours, age: null,
  };
}

describe("la semaine en cartes, la suite en rangs", () => {
  /* L'accueil montre LA SEMAINE. Ce qui vient après se lit plus vite en rangs
     — trois cartes au plus laissaient un tiers d'écran vide sur les grands
     modèles alors que d'autres dates existaient. */
  it("met en cartes ce qui tombe dans les sept jours", () => {
    const a = composeLAccueil([echeance(0), echeance(3), echeance(7), echeance(20)], REMPLISSAGE_PLEIN);
    expect(a.cartes.map((e) => e.daysUntil)).toEqual([0, 3, 7]);
    expect(a.rangs.map((e) => e.daysUntil)).toEqual([20]);
  });

  it("le huitième jour n'est plus la semaine", () => {
    const a = composeLAccueil([echeance(8), echeance(9)], REMPLISSAGE_PLEIN);
    expect(a.cartes.map((e) => e.daysUntil)).toEqual([8, 9]);
  });

  /* Rien cette semaine mais des dates plus loin : on montre les deux
     prochaines en cartes quand même. Un accueil qui n'aurait que des rangs
     n'aurait plus de point d'entrée. */
  it("montre les deux prochaines quand la semaine est vide", () => {
    const a = composeLAccueil([echeance(30), echeance(45), echeance(60)], REMPLISSAGE_PLEIN);
    expect(a.cartes).toHaveLength(MIN_CARTES);
    expect(a.rangs.map((e) => e.daysUntil)).toEqual([60]);
  });

  // Une échéance passée n'est pas « cette semaine ». `daysUntil` est signé, et
  // la vue Dates montre le mois écoulé — pas l'accueil.
  it("ne prend pas une échéance passée pour la semaine", () => {
    const a = composeLAccueil([echeance(-2), echeance(40)], REMPLISSAGE_PLEIN);
    expect(a.cartes.map((e) => e.daysUntil)).toEqual([-2, 40]);
  });
});

describe("ce qui sort porte son compte", () => {
  /* Jamais escamoté. C'est ce qui distingue « il n'y a que ça » de « le reste
     est ailleurs » — et le lien vers Dates dit lequel des deux. */
  it("compte ce qui n'entre nulle part", () => {
    const dix = Array.from({ length: 10 }, (_, i) => echeance(i));
    const a = composeLAccueil(dix, REMPLISSAGE_PLEIN);
    expect(a.cartes).toHaveLength(MAX_CARTES);
    expect(a.rangs).toHaveLength(MAX_RANGS);
    expect(a.reste).toBe(3);
  });

  it("ne compte rien quand tout tient", () => {
    expect(composeLAccueil([echeance(1), echeance(2)], REMPLISSAGE_PLEIN).reste).toBe(0);
  });

  // Aucune échéance : trois listes vides, et pas un compte négatif.
  it("tient le carnet vide", () => {
    const a = composeLAccueil([], REMPLISSAGE_PLEIN);
    expect(a).toEqual({ cartes: [], rangs: [], reste: 0 });
  });

  // Une même échéance ne paraît jamais deux fois : ce qui est en carte sort
  // des rangs, sinon la première ligne redirait la première carte.
  it("ne montre pas deux fois la même", () => {
    const a = composeLAccueil([echeance(1), echeance(2), echeance(3), echeance(4)], REMPLISSAGE_PLEIN);
    const vus = [...a.cartes, ...a.rangs].map((e) => e.id);
    expect(new Set(vus).size).toBe(vus.length);
  });
});

describe("la mesure ne fait que rétrécir", () => {
  /* Les rangs partent d'abord — ils portent moins. Puis une carte, et jamais
     en dessous de deux : sur un petit modèle, trois cartes seules dépassent
     déjà la hauteur, et retirer des rangs n'y change rien. */
  it("retire les rangs avant les cartes", () => {
    let etat = REMPLISSAGE_PLEIN;
    for (let i = MAX_RANGS; i > 0; i--) {
      etat = retrecit(etat)!;
      expect(etat.cartes).toBe(MAX_CARTES);
    }
    expect(etat.rangs).toBe(0);
    expect(retrecit(etat)!.cartes).toBe(MAX_CARTES - 1);
  });

  /* Rien à retirer : `null`. L'écran déborde alors de ce qu'il ne peut plus
     réduire, plutôt que de tourner en rond — c'est l'oscillation sans fin que
     le kit décrit, et qu'un retour au maximum rouvrirait. */
  it("s'arrête au plancher plutôt que de boucler", () => {
    expect(retrecit({ cartes: MIN_CARTES, rangs: 0 })).toBeNull();
  });

  it("descend jusqu'au plancher, pas en dessous", () => {
    let etat: ReturnType<typeof retrecit> = REMPLISSAGE_PLEIN;
    for (let i = 0; i < 50 && etat; i++) etat = retrecit(etat);
    expect(etat).toBeNull();
  });
});

describe("le retour au maximum n'appartient qu'au redimensionnement", () => {
  /* Sans seuil : retirer un rang change la hauteur, ce qui redemande le
     maximum, qui déborde, qui retire un rang. Le seuil sépare ce que le
     système fait — une rotation, un clavier — de ce que nous faisons. */
  it("ignore les quelques pixels de notre propre retrait", () => {
    expect(doitRepartirDuMaximum(600, 600)).toBe(false);
    expect(doitRepartirDuMaximum(600 - SEUIL_DE_REDIMENSIONNEMENT + 1, 600)).toBe(false);
  });

  it("repart au maximum sur un vrai changement de hauteur", () => {
    expect(doitRepartirDuMaximum(600 - SEUIL_DE_REDIMENSIONNEMENT, 600)).toBe(true);
    expect(doitRepartirDuMaximum(900, 600)).toBe(true);
  });

  // La première mesure n'a rien à comparer : elle ne redemande rien.
  it("ne repart pas sur la toute première mesure", () => {
    expect(doitRepartirDuMaximum(600, null)).toBe(false);
  });
});

describe("les deux états vides ne se ressemblent pas", () => {
  const home = (occurrences: Occurrence[], hasPersons: boolean): Home => ({
    firstName: "Valentine", occurrences, counts: { today: 0, thisWeek: 0 },
    unreadNotifications: 0, hasPersons, remainingOccurrences: 0,
  });

  /* Carnet neuf : l'écran ne poursuit qu'un but, conduire au premier ajout.
     « Laisser une note » céderait la place — il n'y a personne à propos de qui
     écrire. */
  it("un carnet neuf appelle le premier ajout", () => {
    expect(etatDeLAccueil(home([], false))).toBe("premier");
  });

  /* Carnet rempli mais rien qui approche : « Laisser une note » demeure. Une
     liste vide ne dit pas lequel des deux — c'est `hasPersons` qui tranche, et
     sans lui le client appellerait `/me/persons` pour choisir un libellé. */
  it("un carnet rempli sans date proche garde la note", () => {
    expect(etatDeLAccueil(home([], true))).toBe("vide");
  });

  it("une échéance suffit à sortir des deux", () => {
    expect(etatDeLAccueil(home([echeance(3)], true))).toBe("nominal");
    expect(etatDeLAccueil(home([echeance(3)], false))).toBe("nominal");
  });
});

describe("ce que le serveur garde par-devers lui", () => {
  /* `/me/home` ne rend que les échéances les plus proches — trois au moment où
     j'écris. Sans `remainingOccurrences`, « Voir plus · n restants » était
     INATTEIGNABLE : l'écran disait « Voir tout » alors qu'il en manquait vingt.
     C'était un défaut vu à l'écran, et le contrat l'a réparé. */
  it("compte ce qui n'est pas venu, pas seulement ce qui ne tient pas", () => {
    const a = composeLAccueil([echeance(1), echeance(2)], REMPLISSAGE_PLEIN, 20);
    expect(a.cartes).toHaveLength(2);
    expect(a.rangs).toHaveLength(0);
    expect(a.reste).toBe(20);
  });

  // Les deux s'additionnent : ce que la page laisse dehors ET ce que le serveur
  // n'a pas envoyé. Compter l'un sans l'autre annoncerait un reste trop court.
  it("additionne les deux manques", () => {
    const dix = Array.from({ length: 10 }, (_, i) => echeance(i));
    expect(composeLAccueil(dix, REMPLISSAGE_PLEIN, 5).reste).toBe(8);
  });

  it("ne compte rien quand tout est là et tout tient", () => {
    expect(composeLAccueil([echeance(1)], REMPLISSAGE_PLEIN, 0).reste).toBe(0);
  });
});
