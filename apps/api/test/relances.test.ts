import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { RelancesService } from "../src/me/relances.service.js";

/* Les relances vont chercher la matière quand rien n'arrive tout seul.
 *
 * Ces cas visent les pièges plutôt que le nominal : ce qui coûte cher ici n'est
 * pas de rater une relance, c'est d'en envoyer une à quelqu'un qui a déjà fait
 * ce qu'on lui demande. */
describe("les relances", () => {
  let db: TestDb;
  let relances: RelancesService;
  let awa: string;

  const ilYA = (jours: number): Date => new Date(Date.now() - jours * 86_400_000);
  const dans = (jours: number): Date => new Date(Date.now() + jours * 86_400_000);

  const compte = async (creeIlYA = 1): Promise<string> => {
    const u = await db.prisma.user.create({
      data: {
        email: `${randomBytes(6).toString("hex")}@example.com`,
        username: `u${randomBytes(4).toString("hex")}`,
        referralCode: randomBytes(4).toString("hex").toUpperCase(),
        createdAt: ilYA(creeIlYA),
      },
      select: { id: true },
    });
    return u.id;
  };

  const proche = async (userId: string, noteIlYA?: number): Promise<string> => {
    const p = await db.prisma.person.create({
      data: { userId, displayName: "Valery" }, select: { id: true },
    });
    if (noteIlYA !== undefined) {
      await db.prisma.note.create({
        data: { personId: p.id, authorUserId: userId, content: "une note", createdAt: ilYA(noteIlYA) },
      });
    }
    return p.id;
  };

  const filesDe = async (type: string): Promise<number> =>
    db.prisma.notification.count({ where: { type: type as never } });

  beforeAll(async () => { db = await withDatabase(); }, 120_000);
  afterAll(async () => { await db.close(); });
  beforeEach(async () => {
    await resetDatabase(db.prisma);
    relances = new RelancesService(db.prisma as never);
    awa = await compte(60);
  });

  describe("le carnet qui dort", () => {
    it("relance un compte sans note depuis plus d'un mois", async () => {
      await proche(awa, 45);
      await relances.enrichissementGlobal();
      expect(await filesDe("enrichment_nudge_global")).toBeGreaterThan(0);
    });

    /* Celui qui n'a JAMAIS rien noté est le plus important, et c'est celui
       qu'un « dernière note antérieure au seuil » raterait — il n'a pas de
       dernière note. */
    it("relance aussi un compte qui n'a jamais rien noté", async () => {
      await proche(awa);
      await relances.enrichissementGlobal();
      expect(await filesDe("enrichment_nudge_global")).toBeGreaterThan(0);
    });

    it("laisse tranquille qui a noté récemment", async () => {
      await proche(awa, 3);
      await relances.enrichissementGlobal();
      expect(await filesDe("enrichment_nudge_global")).toBe(0);
    });

    // La cadence ne se règle pas : elle vient de la clé, qui porte le mois.
    it("ne relance qu'une fois dans le mois, même relancée dix fois", async () => {
      await proche(awa, 45);
      for (let i = 0; i < 3; i += 1) await relances.enrichissementGlobal();
      const parCanal = await db.prisma.notification.groupBy({
        by: ["channel"], where: { type: "enrichment_nudge_global" }, _count: { _all: true },
      });
      for (const c of parCanal) expect(c._count._all).toBe(1);
    });

    // Un compte suspendu ou en cours de suppression ne reçoit rien.
    it("ne relance pas un compte qui n'est plus actif", async () => {
      await proche(awa, 45);
      await db.prisma.user.update({ where: { id: awa }, data: { status: "suspended" } });
      await relances.enrichissementGlobal();
      expect(await filesDe("enrichment_nudge_global")).toBe(0);
    });
  });

  describe("la fiche muette dont l'échéance approche", () => {
    const echeance = async (userId: string, personId: string, dansJours: number): Promise<void> => {
      const e = await db.prisma.event.create({
        data: {
          personId, authorUserId: userId, kind: "other", label: "Jalon",
          referenceDate: dans(dansJours),
        },
        select: { id: true },
      });
      await db.prisma.eventOccurrence.create({
        data: { eventId: e.id, userId, occurrenceDate: dans(dansJours), occurrenceYear: 2026 },
      });
    };

    it("relance quand l'échéance approche ET que la matière est ancienne", async () => {
      const p = await proche(awa, 45);
      await echeance(awa, p, 10);
      await relances.enrichissementParPersonne();
      expect(await filesDe("enrichment_nudge_person")).toBeGreaterThan(0);

      // Sans le nom, ce message ne veut rien dire : il parle d'une personne
      // précise dont on n'a rien noté.
      const n = await db.prisma.notification.findFirst({
        where: { type: "enrichment_nudge_person" }, select: { bodyParams: true },
      });
      expect(n!.bodyParams).toMatchObject({ person: "Valery" });
    });

    /* Le déclencheur est DOUBLE. Une échéance seule est déjà couverte par le
       rappel : relancer dessus doublerait le message sans rien apporter. */
    it("ne relance pas sur une échéance dont la fiche est fournie", async () => {
      const p = await proche(awa, 2);
      await echeance(awa, p, 10);
      await relances.enrichissementParPersonne();
      expect(await filesDe("enrichment_nudge_person")).toBe(0);
    });

    // Et une fiche pauvre sans échéance proche ne presse pas : c'est la
    // relance globale qui s'en occupe, une fois par mois.
    it("ne relance pas sur une fiche muette dont rien n'approche", async () => {
      const p = await proche(awa, 45);
      await echeance(awa, p, 120);
      await relances.enrichissementParPersonne();
      expect(await filesDe("enrichment_nudge_person")).toBe(0);
    });
  });

  describe("l'activation d'un compte neuf", () => {
    it("relance un compte neuf sans aucun proche", async () => {
      const neuf = await compte(2);
      await relances.activations();
      const n = await db.prisma.notification.count({
        where: { userId: neuf, type: "activation_first_person" },
      });
      expect(n).toBeGreaterThan(0);
    });

    /* LA condition non négociable : le but se revérifie à chaque passage. La
       file peut avoir été garnie hier et la personne avoir agi ce matin —
       envoyer « créez votre premier proche » à quelqu'un qui en a douze détruit
       la confiance plus sûrement que dix relances de trop. */
    it("s'arrête dès que le but est atteint, même en cours de fenêtre", async () => {
      const neuf = await compte(2);
      await relances.activations();
      const avant = await db.prisma.notification.count({
        where: { userId: neuf, type: "activation_first_person" },
      });

      await proche(neuf);
      await relances.activations();

      expect(await db.prisma.notification.count({
        where: { userId: neuf, type: "activation_first_person" },
      })).toBe(avant);
    });

    // Hors fenêtre, on abandonne : une relance d'activation trois mois après
    // l'inscription n'active personne.
    it("ne relance pas hors de la fenêtre d'activation", async () => {
      const vieux = await compte(90);
      await relances.activations();
      expect(await db.prisma.notification.count({ where: { userId: vieux } })).toBe(0);
    });

    /* Le renoncement posé depuis le lien d'un courrier coupe TOUTES les
       relances d'activation d'un coup, sans connexion. C'est ce qui remplace
       l'interrupteur d'écran qu'on n'atteindrait pas à temps. */
    it("respecte le renoncement posé depuis le courrier", async () => {
      const neuf = await compte(2);
      await db.prisma.user.update({
        where: { id: neuf }, data: { activationEmailsOptedOut: true },
      });
      await relances.activations();
      expect(await db.prisma.notification.count({ where: { userId: neuf } })).toBe(0);
    });

    // Deux envois au maximum, puis on abandonne. Une relance qui insiste
    // apprend à ignorer l'application — et emporte les rappels avec elle.
    it("abandonne après le plafond d'envois", async () => {
      const neuf = await compte(2);
      for (let i = 0; i < 5; i += 1) await relances.activations();
      const n = await db.prisma.notification.count({
        where: { userId: neuf, type: "activation_first_person", channel: "email" },
      });
      expect(n).toBe(2);
    });

    /* L'activation ne passe jamais par le téléphone : « créez votre premier
       proche » sur un écran de verrouillage est de la relance marchande. */
    it("ne pousse jamais une relance d'activation sur le téléphone", async () => {
      const neuf = await compte(2);
      await db.prisma.device.create({
        data: { userId: neuf, pushToken: "jeton", platform: "android" },
      });
      await relances.activations();
      const canaux = await db.prisma.notification.findMany({
        where: { userId: neuf }, select: { channel: true },
      });
      expect(canaux.map((c) => c.channel)).not.toContain("push");
    });
  });
});
