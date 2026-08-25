import { describe, expect, it } from "vitest";
import {
  notificationSchema, resumableSchema, searchResultSchema,
  updateNotificationPreferencesSchema, updateWallSchema, wallSchema,
} from "./me-app.js";

const ID = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";

describe("le Mur", () => {
  const MUR = {
    slug: "valentine",
    isEnabled: false,
    showBirthdayDate: true,
    welcomeMessage: null,
    publicUrl: "https://lehno.app/valentine",
    wishLinkUrl: null,
  };

  it("se lit non publié, avec son adresse déjà connue", () => {
    // L'adresse existe avant la publication : l'écran la montre pour qu'on
    // sache ce qu'on s'apprête à ouvrir.
    expect(wallSchema.parse(MUR).publicUrl).toBe("https://lehno.app/valentine");
  });

  // « Le Mur expose le lien de l'occurrence courante ; une nouvelle occurrence
  // chaque année ⇒ un nouveau lien. » Hors fenêtre de vœux, il n'y en a pas.
  it("n'a pas toujours un lien de dépôt de vœux", () => {
    expect(wallSchema.parse(MUR).wishLinkUrl).toBeNull();
  });

  it("refuse un PATCH vide", () => {
    expect(() => updateWallSchema.parse({})).toThrow();
    expect(() => updateWallSchema.parse({ isEnabled: true })).not.toThrow();
  });
});

describe("les notifications", () => {
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

  /* « Les natures login_code, security et account partent quelles que soient les
     préférences. » Les laisser régler afficherait un interrupteur sans effet —
     et un interrupteur sans effet apprend à ne pas croire les interrupteurs. */
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
});

describe("la recherche", () => {
  it("rend de quoi reconnaître la bonne personne sans ouvrir", () => {
    const resultat = searchResultSchema.parse({
      personId: ID,
      displayName: "Awa Diop",
      avatarUrl: null,
      nextOccurrenceKind: "birthday",
      nextOccurrenceDate: "2026-08-24",
      daysUntil: -1,
    });
    expect(resultat.displayName).toBe("Awa Diop");
  });

  // Un proche sans date n'a pas de prochaine échéance, et la recherche doit
  // quand même le rendre : c'est souvent lui qu'on cherche pour la lui ajouter.
  it("rend un proche sans échéance à venir", () => {
    expect(() => searchResultSchema.parse({
      personId: ID, displayName: "Awa Diop", avatarUrl: null,
      nextOccurrenceKind: null, nextOccurrenceDate: null, daysUntil: null,
    })).not.toThrow();
  });
});

describe("les reprises", () => {
  // « Rien ne se perd : ce qu'on a lancé se retrouve ici. » Deux natures, et
  // l'état où en est l'élément — brouillon, à approuver, à partager.
  it("distingue un brouillon de message d'un portrait à finir", () => {
    const brouillon = resumableSchema.parse({
      id: ID, kind: "message_draft", state: "draft",
      personId: "3f2504e0-4f89-11d3-9a0c-0305e82c3302", personDisplayName: "Awa Diop",
      occurrenceId: "3f2504e0-4f89-11d3-9a0c-0305e82c3303", daysUntil: 3,
      updatedAt: "2026-08-25T03:00:00.000Z",
    });
    expect(brouillon.kind).toBe("message_draft");
  });

  // Un portrait se génère hors de toute échéance : il n'a ni occasion ni
  // décompte, et le classement par urgence le range après ceux qui en ont une.
  it("accepte un portrait sans occasion ni décompte", () => {
    expect(() => resumableSchema.parse({
      id: ID, kind: "portrait", state: "to_approve",
      personId: "3f2504e0-4f89-11d3-9a0c-0305e82c3302", personDisplayName: "Awa Diop",
      occurrenceId: null, daysUntil: null,
      updatedAt: "2026-08-25T03:00:00.000Z",
    })).not.toThrow();
  });
});
