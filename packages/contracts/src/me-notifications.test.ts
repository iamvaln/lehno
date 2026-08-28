import { describe, expect, it } from "vitest";
import {
  CONFIGURABLE_NOTIFICATION_TYPES, markNotificationsReadSchema,
  notificationPreferencesSchema, notificationSchema, notificationsPageSchema,
  updateNotificationPreferencesSchema,
} from "./me-notifications.js";

const ID = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";

describe("le centre de notifications", () => {
  const NOTIFICATION = {
    id: ID,
    type: "event_reminder" as const,
    titleKey: "notif.rappel.titre",
    bodyParams: { prenom: "Awa", jours: 3 },
    targetRoute: "/occasion/3f2504e0-4f89-11d3-9a0c-0305e82c3302",
    personId: null,
    eventOccurrenceId: "3f2504e0-4f89-11d3-9a0c-0305e82c3302",
    readAt: null,
    notifiedAt: "2026-08-25T03:00:00.000Z",
  };

  /* « Le serveur transporte des clés, jamais des phrases — la langue
     d'interface peut changer après l'envoi. » Une notification émise il y a
     trois semaines en français doit se relire en anglais si l'utilisateur a
     changé de langue depuis. C'est l'inverse du catalogue du studio, dont les
     libellés arrivent résolus : lui est servi à l'instant où il s'affiche. */
  it("transporte une clé de traduction, pas une phrase", () => {
    const lu = notificationSchema.parse(NOTIFICATION);
    expect(lu.titleKey).toBe("notif.rappel.titre");
    expect(lu.bodyParams).toEqual({ prenom: "Awa", jours: 3 });
  });

  // « Une notification mène là où l'on agit » — et la spec 3.13 est explicite :
  // elle mène directement à l'écran concerné, sans passer par la liste.
  it("porte l'écran où elle mène", () => {
    expect(notificationSchema.parse(NOTIFICATION).targetRoute).toContain("/occasion/");
  });

  it("refuse une phrase là où une clé est attendue", () => {
    expect(() => notificationSchema.parse({ ...NOTIFICATION, title: "Rappel" })).toThrow();
  });

  /* La cible brute voyage AVEC la route. Sans elle, un client qui navigue par
     écran typé découperait `/occasion/<uuid>` pour retrouver l'identifiant :
     le jour où la route change, il ouvre des écrans vides, et rien ne tombe
     côté serveur puisque le serveur reste cohérent avec lui-même. */
  it("porte la cible brute, pas seulement l'URL où la lire", () => {
    const lu = notificationSchema.parse(NOTIFICATION);
    expect(lu.eventOccurrenceId).toBe("3f2504e0-4f89-11d3-9a0c-0305e82c3302");
  });

  /* `created_at` n'est PAS la date de l'entrée : la programmation écrit les
     rappels jusqu'à un mois avant leur échéance. Le contrat n'expose donc
     qu'une date, celle où l'entrée devient visible — deux obligeraient le
     client à porter la règle qui choisit entre elles. */
  it("ne rend qu'une date, et c'est celle de l'échéance", () => {
    expect(() => notificationSchema.parse({ ...NOTIFICATION, createdAt: "2026-07-01T00:00:00.000Z" }))
      .toThrow();
  });

  /* Le centre grandit par le haut : un `offset` ferait réapparaître la
     dernière entrée d'une page en tête de la suivante, et en escamoterait une
     autre. Le curseur désigne une ligne, pas un rang. */
  it("pagine par curseur, et rend le décompte non lu avec la page", () => {
    const page = notificationsPageSchema.parse({
      items: [NOTIFICATION], nextCursor: null, unreadCount: 1,
    });
    expect(page.nextCursor).toBeNull();
    expect(page.unreadCount).toBe(1);
    expect(notificationsPageSchema.safeParse({
      items: [], nextCursor: null, unreadCount: 0, offset: 20,
    }).success).toBe(false);
  });
});

describe("marquer comme lu", () => {
  const ID = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";

  /* Le corps vide est le piège : un `{}` qui vaudrait « tout » ferait qu'un
     client dont la sélection est restée vide éteindrait la pastille de
     quelqu'un qui n'a rien lu. « Tout » se tape, il ne s'obtient pas par
     omission. */
  it("refuse un corps qui ne dit pas ce qu'il marque", () => {
    expect(markNotificationsReadSchema.safeParse({}).success).toBe(false);
    expect(markNotificationsReadSchema.safeParse({ ids: [] }).success).toBe(false);
    expect(markNotificationsReadSchema.safeParse({ all: false }).success).toBe(false);
  });

  it("accepte une liste d'identifiants, ou tout", () => {
    expect(markNotificationsReadSchema.safeParse({ ids: [ID] }).success).toBe(true);
    expect(markNotificationsReadSchema.safeParse({ all: true }).success).toBe(true);
  });

  // Les deux formes s'excluent : un corps qui dit les deux ne dit rien de
  // clair, et le serveur devrait deviner laquelle l'emporte.
  it("refuse les deux formes à la fois", () => {
    expect(markNotificationsReadSchema.safeParse({ all: true, ids: [ID] }).success).toBe(false);
  });
});

describe("les préférences de notification", () => {
  // Chaque type configurable rend son état effectif — présent ou par défaut,
  // le contrat ne fait pas la différence : c'est le rôle du serveur, pas du
  // schéma, de savoir laquelle des deux c'est.
  it("rend l'état de chaque type configurable, plus la fréquence du récapitulatif", () => {
    const lu = notificationPreferencesSchema.parse({
      preferences: CONFIGURABLE_NOTIFICATION_TYPES.map((type) => (
        { type, pushEnabled: true, emailEnabled: true }
      )),
      digestFrequency: "monthly",
    });
    expect(lu.preferences).toHaveLength(CONFIGURABLE_NOTIFICATION_TYPES.length);
  });

  /* « Les natures login_code, security et account partent quelles que soient
     les préférences. » Les laisser régler afficherait un interrupteur sans
     effet — et un interrupteur sans effet apprend à ne pas croire les
     interrupteurs. */
  it("ne laisse pas régler les natures qui partent toujours", () => {
    expect(() => updateNotificationPreferencesSchema.parse({
      preferences: [{ type: "event_reminder", pushEnabled: false, emailEnabled: true }],
    })).not.toThrow();
    for (const type of ["login_code", "security", "account"]) {
      expect(() => updateNotificationPreferencesSchema.parse({
        preferences: [{ type, pushEnabled: false, emailEnabled: false }],
      }), type).toThrow();
    }
  });

  it("refuse un PATCH vide", () => {
    expect(() => updateNotificationPreferencesSchema.parse({})).toThrow();
    expect(() => updateNotificationPreferencesSchema.parse({ preferences: [] })).toThrow();
  });

  // Changer seulement la fréquence du récapitulatif, sans toucher aux
  // canaux, est un PATCH légitime : les deux réglages sont indépendants.
  it("accepte un PATCH qui ne touche que la fréquence du récapitulatif", () => {
    expect(() => updateNotificationPreferencesSchema.parse({ digestFrequency: "never" }))
      .not.toThrow();
  });

  // `sendHour` n'a pas sa place ici : il vaut pour toutes les natures et vit
  // sur /me/profile. Un client qui tenterait de le poser via ce chemin doit
  // être refusé, pas silencieusement ignoré (`.strict()`).
  it("refuse sendHour, qui vit sur /me/profile", () => {
    expect(() => updateNotificationPreferencesSchema.parse({
      preferences: [{ type: "event_reminder", pushEnabled: true, emailEnabled: true }],
      sendHour: 9,
    })).toThrow();
  });
});
