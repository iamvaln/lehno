import { describe, expect, it } from "vitest";
import { markNotificationsReadSchema, type Notification } from "@lehno/contracts";
import { fr } from "../messages/fr.js";
import {
  cibleDeLaNotification, clesSansLibelle, corpsDeLecture, corpsDeToutLire,
  estDAujourdhui, libelleDeLaNotification,
} from "../lib/notifications.js";

const uuid = (n: number): string =>
  `${String(n).padStart(8, "0")}-0000-4000-8000-000000000000`;

const notif = (p: Partial<Notification> = {}): Notification => ({
  id: uuid(1), type: "event_reminder", titleKey: "notification.event_reminder",
  bodyParams: { person: "Ana", days: 3 },
  targetRoute: "/occurrences/" + uuid(9),
  personId: uuid(5), eventOccurrenceId: uuid(9), readAt: null,
  notifiedAt: "2026-08-30T06:00:00.000Z", ...p,
});

describe("où mène une notification", () => {
  /* ON NE DÉCOUPE JAMAIS `targetRoute` : « lui faire découper
     /occurrences/<uuid> pour retrouver l'identifiant, c'est lui faire
     réimplémenter la grammaire d'URL du serveur — le jour où elle change,
     l'application ouvre des écrans vides sans qu'aucun test ne tombe ». */
  it("lit les références, jamais le chemin", () => {
    expect(cibleDeLaNotification(notif())).toEqual({ sorte: "occasion", id: uuid(9) });
  });

  // L'occasion prime : on veut agir sur ce qui approche, pas ouvrir la fiche.
  it("préfère l'occasion au proche", () => {
    expect(cibleDeLaNotification(notif())?.sorte).toBe("occasion");
    expect(cibleDeLaNotification(notif({ eventOccurrenceId: null }))?.sorte).toBe("proche");
  });

  /* UNE CIBLE DISPARUE REND L'ENTRÉE INERTE. « Un proche supprimé vide
     `personId` mais laisse `targetRoute` pointer sur sa fiche disparue » — et
     suivre le chemin ouvrirait un écran mort. */
  it("devient inerte quand les deux références sont vides", () => {
    expect(cibleDeLaNotification(notif({
      personId: null, eventOccurrenceId: null, targetRoute: "/persons/" + uuid(5),
    }))).toBeNull();
  });
});

describe("ce qu'une entrée dit", () => {
  /* Le NOM voyage avec la notification : « une notification est ce qu'on lit en
     premier, souvent hors connexion » — le résoudre depuis `personId`
     demanderait un appel qu'on ne peut pas faire. */
  it("compose depuis les paramètres, pas depuis une requête", () => {
    expect(libelleDeLaNotification(notif(), fr)).toBe(fr.notifRappel("Ana", 3));
  });

  it("dit le jour même autrement", () => {
    const rendu = libelleDeLaNotification(
      notif({ titleKey: "notification.event_day_of", bodyParams: { person: "Ana" } }), fr,
    );
    expect(rendu).toBe(fr.notifAujourdhui("Ana"));
  });

  /* Une clé qu'on ne sait pas rendre donne `null`, et l'entrée ne s'affiche
     pas. Montrer « notification.activation_first_note » serait pire que de se
     taire : c'est du vocabulaire interne, et ça n'apprend rien. */
  it("se tait plutôt que d'afficher une clé brute", () => {
    expect(libelleDeLaNotification(notif({ titleKey: "notification.inconnue" }), fr))
      .toBeNull();
  });

  // Des paramètres incomplets ne composent pas une demi-phrase.
  it("se tait quand les paramètres manquent", () => {
    expect(libelleDeLaNotification(notif({ bodyParams: { person: "Ana" } }), fr)).toBeNull();
    expect(libelleDeLaNotification(notif({ bodyParams: null }), fr)).toBeNull();
  });

  /* CE QUE LE SERVEUR ÉMET ET QUE LA COPIE NE SAIT PAS DIRE. Ces notifications
     partent, arrivent, et n'apparaissent nulle part — un silence qui se voit
     d'autant moins qu'il est silencieux. Ce test le nomme. */
  it("nomme les clés servies sans libellé", () => {
    expect(clesSansLibelle(fr)).toEqual([
      "notification.activation_first_person",
      "notification.activation_first_note",
      "notification.activation_unused_credits",
      "notification.enrichment_nudge_global",
      "notification.enrichment_nudge_person",
      "notification.wish_reserved",
    ]);
  });
});

describe("aujourd'hui, puis avant", () => {
  /* Sur `notifiedAt`, jamais sur la création : « un rappel J-7 pour une date
     dans cinq semaines existe en base depuis quatre semaines quand il devient
     enfin visible — servir `created_at` afficherait *il y a 28 jours* sur un
     rappel arrivé ce matin ». */
  it("se lit sur la date d'entrée dans le centre", () => {
    expect(estDAujourdhui(notif(), "2026-08-30")).toBe(true);
    expect(estDAujourdhui(notif({ notifiedAt: "2026-08-29T23:00:00.000Z" }), "2026-08-30"))
      .toBe(false);
  });
});

describe("marquer comme lu", () => {
  it("compose une liste que le contrat accepte", () => {
    const corps = corpsDeLecture([uuid(1), uuid(2)]);
    expect(markNotificationsReadSchema.safeParse(corps).success).toBe(true);
  });

  it("compose « tout » explicitement", () => {
    expect(corpsDeToutLire()).toEqual({ all: true });
  });

  /* LE CORPS VIDE EST REFUSÉ, et c'est le contrat qui l'exige : « un tableau
     d'identifiants resté vide parce que rien n'était sélectionné viderait la
     pastille de quelqu'un qui n'a rien lu ». On refuse de le composer, plutôt
     que de l'envoyer et de laisser le serveur trancher. */
  it("refuse de composer une lecture vide", () => {
    expect(() => corpsDeLecture([])).toThrow();
  });
});
