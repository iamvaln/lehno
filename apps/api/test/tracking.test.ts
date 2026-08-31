import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { NOMS_EVENEMENTS, ENTETES_MESURE } from "@lehno/contracts";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { TrackingService } from "../src/tracking/tracking.service.js";
import { FlagsService } from "../src/flags/flags.service.js";
import { dansLeContexte, lireEntetes, contexteCourant } from "../src/tracking/contexte.js";
import { mesureDeTest } from "./mesure.js";

describe("le plan de mesure", () => {
  let db: TestDb;
  let awa: string;

  const compte = async (): Promise<string> => {
    const u = await db.prisma.user.create({
      data: {
        email: `${randomBytes(6).toString("hex")}@example.com`,
        username: `u${randomBytes(4).toString("hex")}`,
        referralCode: randomBytes(4).toString("hex").toUpperCase(),
      },
    });
    return u.id;
  };

  beforeAll(async () => { db = await withDatabase(); }, 120_000);
  afterAll(async () => { await db.close(); });
  beforeEach(async () => { await resetDatabase(db.prisma); awa = await compte(); });

  // La convention de §16.2, appliquée au registre plutôt qu'à la relecture
  // d'un humain : `domaine.objet_action`, minuscules, au passé.
  it("chaque nom du registre suit la convention", () => {
    for (const nom of NOMS_EVENEMENTS) {
      expect(nom, nom).toMatch(/^[a-z_]+\.[a-z_]+$/);
    }
  });

  /* LE point de §16.2 : les drapeaux actifs accompagnent CHAQUE événement.
     Sans eux, une courbe qui monte le jour d'une bascule reste inexplicable —
     on ne sait pas si le produit a changé ou la population mesurée. */
  it("attache les drapeaux actifs à chaque événement, sans que l'appelant y pense", async () => {
    await new FlagsService(db.prisma as never).reconcilier();
    await db.prisma.featureFlag.update({ where: { key: "referral" }, data: { enabled: true } });

    const { service, emis, attendre } = mesureDeTest(db.prisma);
    service.emettre(awa, "person.created", { origin: "manual", hasBirthDate: false });
    await attendre();

    expect(emis[0]?.common["flags"]).toContain("referral");
    expect(emis[0]?.common["userId"]).toBe(awa);
  });

  /* Une mesure ne doit jamais faire échouer ce qu'elle mesure : un PostHog en
     panne ne peut pas empêcher une inscription. Le cas se vérifie, il ne se
     suppose pas — c'est exactement le genre de garde qui cesse de protéger
     sans bruit le jour où quelqu'un ajoute un `await`. */
  it("n'échoue pas, et ne laisse AUCUN rejet non traité, quand l'adaptateur tombe", async () => {
    const enPanne = { capture: async (): Promise<void> => { throw new Error("posthog est mort"); } };
    const service = new TrackingService(enPanne, new FlagsService(db.prisma as never));

    /* Le `expect(...).not.toThrow()` seul ne prouve RIEN ici : `emettre` ne
       rend pas de promesse, donc il ne lèvera jamais de façon synchrone, avec
       ou sans garde. C'est le rejet NON TRAITÉ qu'il faut guetter — c'est lui
       qui, en production, abat le processus Node. On l'écoute donc pour de
       bon, sinon ce test se contente de vérifier que du code asynchrone est
       asynchrone. */
    const rejets: unknown[] = [];
    const espion = (raison: unknown): void => { rejets.push(raison); };
    process.on("unhandledRejection", espion);
    try {
      expect(() =>
        service.emettre(awa, "person.created", { origin: "manual", hasBirthDate: true }),
      ).not.toThrow();
      // Deux tours de boucle : le rejet naît après la lecture des drapeaux.
      for (let i = 0; i < 40; i += 1) await new Promise((r) => setTimeout(r, 5));
    } finally {
      process.off("unhandledRejection", espion);
    }
    expect(rejets, "un rejet non traité abat le processus en production").toEqual([]);
  });

  /* Le défaut constaté en intégration le 26/08 : signin.completed partait avec
     userId à null, parce qu'il s'émettait au contrôleur — là où VerifyOutcome ne
     porte pas l'identifiant. Une connexion sans compte ne se rattache à aucun
     parcours, et la rétention à sept, trente et quatre-vingt-dix jours (§16.1)
     devient incalculable. C'est la moitié de ce pour quoi le plan existe. */
  it("attache l'identifiant de compte à une connexion", async () => {
    const { service, emis, attendre } = mesureDeTest(db.prisma);
    service.emettre(awa, "signin.completed", { method: "code" });
    await attendre();
    expect(emis[0]?.common["userId"]).toBe(awa);
  });

  /* Et l'inverse, qui compte autant : une inscription qui COMMENCE n'a pas
     encore de compte. `null` y est la vérité, pas un manque — inventer un
     identifiant à ce moment-là ferait deux personnes d'une seule. */
  it("laisse l'identifiant vide sur une inscription qui commence", async () => {
    const { service, emis, attendre } = mesureDeTest(db.prisma);
    service.emettre(null, "signup.started", { method: "google" });
    await attendre();
    expect(emis[0]?.common["userId"]).toBeNull();
  });

  describe("le contexte client", () => {
    it("lit les en-têtes et les rend disponibles sans les faire voyager", () => {
      const contexte = lireEntetes({
        [ENTETES_MESURE.surface]: "app",
        [ENTETES_MESURE.appVersion]: "1.4.2",
        [ENTETES_MESURE.language]: "fr",
        [ENTETES_MESURE.theme]: "dark",
        [ENTETES_MESURE.sessionId]: "abc123",
      }, "cor-1");

      dansLeContexte(contexte, () => {
        const lu = contexteCourant();
        expect(lu.surface).toBe("app");
        expect(lu.appVersion).toBe("1.4.2");
        expect(lu.sessionId).toBe("abc123");
      });
    });

    // Un en-tête est écrit par le client : il peut porter un retour à la ligne
    // pour casser une ligne de journal, ou mille caractères pour la noyer.
    it("nettoie et borne ce que le client écrit", () => {
      const contexte = lireEntetes({
        [ENTETES_MESURE.appVersion]: "1.0\nFAUX: injecté",
        [ENTETES_MESURE.sessionId]: "x".repeat(500),
      }, null);
      // Ce qui compte n'est pas la chaîne exacte mais ce qui n'y est plus :
      // ni retour à la ligne, ni deux-points, ni espace — de quoi composer une
      // fausse ligne dans un journal.
      expect(contexte.appVersion).not.toMatch(/[\n:\s]/);
      expect(contexte.appVersion).toContain("1.0");
      expect(contexte.sessionId?.length).toBe(64);
    });

    // Une surface inconnue vaut « pas de surface ». Une valeur inventée
    // polluerait une segmentation sans que personne ne s'en aperçoive.
    it("refuse une surface qui n'est pas au contrat", () => {
      expect(lireEntetes({ [ENTETES_MESURE.surface]: "pirate" }, null).surface).toBeNull();
    });

    // Hors requête — un traitement programmé, un test — le contexte est vide
    // plutôt qu'absent : la mesure ne lève pas parce qu'elle n'a pas d'en-tête.
    it("rend un contexte vide hors requête, sans lever", () => {
      expect(contexteCourant().surface).toBeNull();
    });
  });
});
