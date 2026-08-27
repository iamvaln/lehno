import { describe, expect, it } from "vitest";
import {
  CONFIGURABLE_NOTIFICATION_TYPES, notificationPreferencesSchema, notificationSchema,
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
    readAt: null,
    createdAt: "2026-08-25T03:00:00.000Z",
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
