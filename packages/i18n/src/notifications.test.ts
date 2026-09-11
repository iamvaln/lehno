import { describe, expect, it } from "vitest";
import { CLES_COMPOSEES, phraseDeNotification } from "./notifications.js";
import { LOCALES } from "./locale.js";

const RAPPEL = { days: 7, date: "2026-03-14", person: "Célarine", nature: "happy" };

describe("les phrases de notification", () => {
  it.each(LOCALES)("%s rend chaque clé que le module déclare savoir rendre", (locale) => {
    const params: Record<string, Record<string, unknown>> = {
      "notification.event_reminder": RAPPEL,
      "notification.event_day_of": { date: "2026-03-14", person: "Célarine", nature: "happy" },
      "notification.enrichment_nudge_global": { silenceDays: 31 },
      "notification.enrichment_nudge_person": { person: "Célarine" },
      "notification.activation_first_person": { envoi: 1 },
      "notification.activation_first_note": { envoi: 1 },
      "notification.activation_unused_credits": { envoi: 1 },
      "notification.wish_reserved": { wishLabel: "Un carnet" },
      "notification.own_date_reminder": { days: 7, date: "2026-03-14", nature: "happy" },
      "notification.own_date_day_of": { date: "2026-03-14", nature: "happy" },
    };
    const muettes = CLES_COMPOSEES.filter(
      (cle) => phraseDeNotification(cle, params[cle] ?? {}, locale) === null,
    );
    expect(muettes).toEqual([]);
  });

  it("les deux langues savent rendre exactement les mêmes clés", () => {
    const rendues = (locale: (typeof LOCALES)[number]): string[] =>
      CLES_COMPOSEES.filter((cle) => phraseDeNotification(cle, RAPPEL, locale) !== null);
    // Sur les mêmes paramètres, une clé rendue d'un côté et muette de l'autre
    // ferait un courrier en français et un silence en anglais.
    expect(rendues("fr")).toEqual(rendues("en"));
  });

  /* Le cas qui justifie tout le reste : le ton suit la nature de l'occasion. */
  it("une occasion sensible ne reçoit jamais un ton chaleureux", () => {
    const sensible = phraseDeNotification(
      "notification.event_day_of",
      { date: "2026-03-14", person: "Célarine", nature: "sensitive" },
      "fr",
    );
    expect(sensible).toEqual({ titre: "C'est aujourd'hui", corps: "Une date notée pour Célarine." });
  });

  it("une nature absente est traitée comme sensible, pas comme heureuse", () => {
    // L'erreur n'est pas symétrique : un ton sobre sur un anniversaire heureux
    // est fade, l'inverse est impardonnable. Le repli doit fader.
    const sans = phraseDeNotification(
      "notification.event_day_of",
      { date: "2026-03-14", person: "Célarine" },
      "fr",
    );
    const heureux = phraseDeNotification(
      "notification.event_day_of",
      { date: "2026-03-14", person: "Célarine", nature: "happy" },
      "fr",
    );
    expect(sans?.titre).toBe("C'est aujourd'hui");
    expect(sans).not.toEqual(heureux);
  });

  it("une clé inconnue se tait plutôt que d'écrire du vocabulaire interne", () => {
    expect(phraseDeNotification("notification.inventee", {}, "fr")).toBeNull();
  });

  it("un paramètre indispensable qui manque fait taire la notification", () => {
    // Mieux vaut un rappel manqué qu'un courrier disant « une date pour
    // undefined approche ».
    expect(phraseDeNotification("notification.event_reminder", { days: 7 }, "fr")).toBeNull();
    expect(phraseDeNotification("notification.enrichment_nudge_person", {}, "en")).toBeNull();
  });

  it("des paramètres qui ne sont pas un objet ne font pas tomber la composition", () => {
    // La colonne est du JSON : elle peut porter un tableau, une chaîne, null.
    expect(phraseDeNotification("notification.activation_first_note", null, "fr")).not.toBeNull();
    expect(phraseDeNotification("notification.activation_first_note", "bruit", "fr")).not.toBeNull();
    expect(phraseDeNotification("notification.event_reminder", [1, 2], "fr")).toBeNull();
  });

  /* La date se découpe à la main, et c'est ce test qui le protège : passer par
     `new Date("2026-03-01")` rendrait « 28 février » à l'ouest de Greenwich. */
  it("la date se rend sans décalage de fuseau", () => {
    const p = phraseDeNotification(
      "notification.event_reminder",
      { ...RAPPEL, date: "2026-03-01" },
      "fr",
    );
    expect(p?.corps).toContain("1er mars");
  });

  it("le premier du mois s'écrit « 1er » en français et « March 1 » en anglais", () => {
    const fr = phraseDeNotification("notification.event_reminder", { ...RAPPEL, date: "2026-03-01" }, "fr");
    const en = phraseDeNotification("notification.event_reminder", { ...RAPPEL, date: "2026-03-01" }, "en");
    expect(fr?.corps).toContain("1er mars");
    expect(en?.corps).toContain("March 1");
  });

  it("un jour de délai se dit « demain », pas « dans 1 jours »", () => {
    const fr = phraseDeNotification("notification.event_reminder", { ...RAPPEL, days: 1 }, "fr");
    const en = phraseDeNotification("notification.event_reminder", { ...RAPPEL, days: 1 }, "en");
    expect(fr?.corps).toContain("demain");
    expect(en?.corps).toContain("tomorrow");
  });

  it("le second envoi d'une relance dit autre chose, il ne répète pas", () => {
    const un = phraseDeNotification("notification.activation_first_person", { envoi: 1 }, "fr");
    const deux = phraseDeNotification("notification.activation_first_person", { envoi: 2 }, "fr");
    expect(deux).not.toEqual(un);
  });

  it("un souhait réservé ne nomme le réservant que s'il l'a autorisé", () => {
    const anonyme = phraseDeNotification("notification.wish_reserved", { wishLabel: "Un carnet" }, "fr");
    const nomme = phraseDeNotification(
      "notification.wish_reserved",
      { wishLabel: "Un carnet", by: "Awa" },
      "fr",
    );
    expect(anonyme?.corps).toBe("Un carnet.");
    expect(nomme?.corps).toBe("Un carnet, par Awa.");
  });

  /* Le ton interdit le point d'exclamation, en anglais plus encore qu'en
     français — c'est le premier glissement vers le casual. */
  it("aucune phrase ne porte de point d'exclamation", () => {
    const toutes = LOCALES.flatMap((locale) =>
      CLES_COMPOSEES.flatMap((cle) => {
        const p = phraseDeNotification(cle, { ...RAPPEL, wishLabel: "Un carnet", envoi: 1 }, locale);
        return p === null ? [] : [p.titre, p.corps];
      }),
    );
    expect(toutes.filter((t) => t.includes("!"))).toEqual([]);
  });

  /* ─── MA PROPRE DATE ────────────────────────────────────────────────────────
   *
   * Ce qu'on a à rappeler sur sa propre date n'est pas d'écrire un mot — on
   * n'écrit pas un mot à soi-même — c'est de préparer sa liste, puis de LA
   * PARTAGER : une liste que personne n'a reçue ne sert à rien. */
  describe("ma propre date", () => {
    const rappel = (etat: Record<string, unknown>) =>
      phraseDeNotification(
        "notification.own_date_reminder",
        { days: 7, date: "2026-03-14", nature: "happy", ...etat },
        "fr",
      );

    it("ne nomme personne", () => {
      // « Une date pour Valentine approche », lu par Valentine, est le défaut
      // que tout ce chantier répare. Le nom voyage encore dans les paramètres,
      // mais aucune phrase à soi ne le pose.
      const p = rappel({ wishCount: 0, isShared: false, person: "Valentine" });
      expect(p?.titre).not.toContain("Valentine");
      expect(p?.corps).not.toContain("Valentine");
    });

    it("propose de préparer la liste quand il n'y en a pas", () => {
      expect(rappel({ wishCount: 0, isShared: false })?.corps).toContain("préparer votre liste");
    });

    it("propose de la partager quand elle est prête", () => {
      expect(rappel({ wishCount: 3, isShared: false })?.corps).toContain("partagée");
    });

    /* UNE LISTE PARTAGÉE NE SE RELANCE PAS. Dire « il n'y a plus rien à faire »
       vaut mieux que de se taire : c'est ce qui distingue un rappel d'une
       relance, et §4.6 l'écrit — « dire le bénéfice, pas l'ordre ». */
    it("ne réclame rien quand elle est déjà partagée", () => {
      const p = rappel({ wishCount: 3, isShared: true });
      expect(p?.corps).toContain("plus rien à faire");
      expect(p?.corps).not.toContain("préparer");
    });

    /* LE CAS QUI COMPTE LE PLUS. Proposer de préparer une liste de cadeaux sur
       une date qu'on a notée pour une raison grave est la version à soi de
       l'impardonnable. Aucune des trois phrases ne doit survivre au repli. */
    it("ne parle jamais de liste sur une date sensible", () => {
      for (const etat of [
        { wishCount: 0, isShared: false },
        { wishCount: 3, isShared: false },
        { wishCount: 3, isShared: true },
      ]) {
        for (const cle of ["notification.own_date_reminder", "notification.own_date_day_of"]) {
          const p = phraseDeNotification(
            cle, { days: 7, date: "2026-03-14", nature: "sensitive", ...etat }, "fr",
          );
          expect(p?.corps).not.toContain("liste");
        }
      }
    });

    /* Et une nature ABSENTE fade elle aussi, comme partout ailleurs : un
       paramètre manquant ne doit pas ouvrir la porte au ton chaleureux. */
    it("fade quand la nature manque", () => {
      const sans = phraseDeNotification(
        "notification.own_date_day_of", { date: "2026-03-14", wishCount: 0 }, "fr",
      );
      expect(sans?.corps).not.toContain("liste");
      expect(sans?.titre).toBe("C'est aujourd'hui");
    });
  });
});
