import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { ProgrammationService } from "../src/me/programmation.service.js";

/* La mise en file des rappels.
 *
 * Programmer et envoyer sont deux gestes distincts : la programmation se
 * relance sans risque, l'envoi ne se rejoue pas. Ces cas n'éprouvent que la
 * première — ce qui entre dans la file, et ce qui n'y entre pas. */
describe("la programmation des rappels", () => {
  let db: TestDb;
  let prog: ProgrammationService;
  let awa: string;
  let personne: string;

  const jour = (dans: number): string =>
    new Date(Date.now() + dans * 86_400_000).toISOString().slice(0, 10);
  const dateDe = (d: string): Date => new Date(`${d}T00:00:00Z`);

  // Une échéance nue, sans passer par EventService : ces cas éprouvent la
  // programmation, pas la création.
  const echeance = async (dans: number, leadTimeDays?: number): Promise<string> => {
    const e = await db.prisma.event.create({
      data: {
        personId: personne, authorUserId: awa, kind: "other", label: "Jalon",
        referenceDate: dateDe(jour(dans)),
        ...(leadTimeDays !== undefined
          ? { schedules: { create: [{ type: "recurrent", unit: "year", interval: 1, leadTimeDays }] } }
          : {}),
      },
      select: { id: true },
    });
    const o = await db.prisma.eventOccurrence.create({
      data: {
        eventId: e.id, userId: awa,
        occurrenceDate: dateDe(jour(dans)), occurrenceYear: Number(jour(dans).slice(0, 4)),
      },
      select: { id: true },
    });
    return o.id;
  };

  /* LA MÊME ÉCHÉANCE, MAIS SUR LA FICHE DE SOI. Une date à soi est un `Event`
     pendu à une `Person` comme celle d'un proche — c'est une décision, pas un
     renoncement : scinder la table dupliquerait la récurrence, les échéances,
     les rappels et le calendrier pour un booléen. `isSelf` est donc le SEUL
     séparateur, et ces cas éprouvent qu'il sépare vraiment. */
  const echeanceASoi = async (dans: number, leadTimeDays?: number): Promise<string> => {
    const moi = await db.prisma.person.create({
      data: { userId: awa, displayName: "Valentine", isSelf: true }, select: { id: true },
    });
    const e = await db.prisma.event.create({
      data: {
        personId: moi.id, authorUserId: awa, kind: "birthday",
        referenceDate: dateDe(jour(dans)),
        ...(leadTimeDays !== undefined
          ? { schedules: { create: [{ type: "recurrent", unit: "year", interval: 1, leadTimeDays }] } }
          : {}),
      },
      select: { id: true },
    });
    const o = await db.prisma.eventOccurrence.create({
      data: {
        eventId: e.id, userId: awa,
        occurrenceDate: dateDe(jour(dans)), occurrenceYear: Number(jour(dans).slice(0, 4)),
      },
      select: { id: true },
    });
    return o.id;
  };

  /** Une liste sur cette échéance, avec ou sans souhaits, partagée ou non. */
  const listeSur = async (
    occurrenceId: string, souhaits: number, partagee: boolean,
  ): Promise<string> => {
    const l = await db.prisma.wishlist.create({
      data: { userId: awa, eventOccurrenceId: occurrenceId }, select: { id: true },
    });
    for (let i = 0; i < souhaits; i += 1) {
      await db.prisma.ownerWish.create({ data: { wishlistId: l.id, label: `Souhait ${i}` } });
    }
    if (partagee) {
      await db.prisma.wishlistShareLink.create({
        data: { wishlistId: l.id, token: randomBytes(8).toString("hex") },
      });
    }
    return l.id;
  };

  const filesDe = async (type?: string): Promise<{ channel: string; scheduledFor: Date | null; dedupeKey: string | null }[]> =>
    db.prisma.notification.findMany({
      where: type ? { type: type as never } : {},
      orderBy: { dedupeKey: "asc" },
      select: { channel: true, scheduledFor: true, dedupeKey: true },
    });

  beforeAll(async () => { db = await withDatabase(); }, 120_000);
  afterAll(async () => { await db.close(); });
  beforeEach(async () => {
    await resetDatabase(db.prisma);
    prog = new ProgrammationService(db.prisma as never);
    const u = await db.prisma.user.create({
      data: {
        email: `${randomBytes(6).toString("hex")}@example.com`,
        username: `u${randomBytes(4).toString("hex")}`,
        referralCode: randomBytes(4).toString("hex").toUpperCase(),
      },
    });
    awa = u.id;
    const p = await db.prisma.person.create({
      data: { userId: awa, displayName: "Valery" }, select: { id: true },
    });
    personne = p.id;
  });

  it("programme un rappel au délai réglé, et un le jour même", async () => {
    await echeance(10, 3);
    await prog.programmerRappels();

    const rappels = await filesDe("event_reminder");
    const jourJ = await filesDe("event_day_of");
    expect(rappels.length).toBeGreaterThan(0);
    expect(jourJ.length).toBeGreaterThan(0);
    // Le rappel tombe trois jours avant, le jour J le jour même.
    expect(rappels[0]!.scheduledFor!.toISOString().slice(0, 10)).toBe(jour(7));
    expect(jourJ[0]!.scheduledFor!.toISOString().slice(0, 10)).toBe(jour(10));
  });

  /* Une règle sans délai ne vaut pas « zéro » : elle vaut « comme tout le
     monde ». Sinon composer une répétition ferait taire le rappel — l'inverse
     de ce que l'utilisateur demandait en la composant. */
  it("retombe sur le délai global quand la règle n'en porte pas", async () => {
    await echeance(10);
    await prog.programmerRappels();
    const r = await filesDe("event_reminder");
    // Sept jours par défaut : dix moins sept.
    expect(r[0]!.scheduledFor!.toISOString().slice(0, 10)).toBe(jour(3));
  });

  /* §3.13 : les signalements « se retrouvent TOUJOURS dans ce centre ». Le
     canal in_app ne dépend d'aucune préférence — ce sont le téléphone et le
     courrier qui se règlent. */
  it("pose toujours le canal du centre, quelles que soient les préférences", async () => {
    await db.prisma.notificationPreference.create({
      data: { userId: awa, type: "event_reminder", pushEnabled: false, emailEnabled: false },
    });
    await echeance(10, 3);
    await prog.programmerRappels();

    const canaux = (await filesDe("event_reminder")).map((n) => n.channel);
    expect(canaux).toEqual(["in_app"]);
  });

  it("ajoute le courrier quand rien n'est réglé — le défaut est activé", async () => {
    await echeance(10, 3);
    await prog.programmerRappels();
    const canaux = (await filesDe("event_reminder")).map((n) => n.channel).sort();
    expect(canaux).toContain("in_app");
    expect(canaux).toContain("email");
  });

  /* Poser une ligne `push` pour quelqu'un sans appareil créerait une
     notification qui ne partira jamais et restera « en attente » pour toujours
     — une file qui ment sur ce qu'elle contient. */
  it("n'ouvre pas le canal du téléphone sans appareil pour le recevoir", async () => {
    await echeance(10, 3);
    await prog.programmerRappels();
    expect((await filesDe("event_reminder")).map((n) => n.channel)).not.toContain("push");
  });

  it("ouvre le canal du téléphone dès qu'un appareil existe", async () => {
    await db.prisma.device.create({
      data: { userId: awa, pushToken: "jeton-de-test", platform: "android" },
    });
    await echeance(10, 3);
    await prog.programmerRappels();
    expect((await filesDe("event_reminder")).map((n) => n.channel)).toContain("push");
  });

  /* LA propriété : un ordonnanceur tourne tous les jours. Sans elle, chaque
     passage rajouterait une copie de chaque rappel. */
  it("est idempotente : deux passages ne doublent rien", async () => {
    await echeance(10, 3);
    await prog.programmerRappels();
    const un = await filesDe();
    await prog.programmerRappels();
    expect(await filesDe()).toHaveLength(un.length);
  });

  // Deux délais sur un même événement sont deux faits distincts — J-7 et J-1
  // ne sont pas un doublon.
  it("distingue deux délais d'anticipation du même événement", async () => {
    const e = await db.prisma.event.create({
      data: {
        personId: personne, authorUserId: awa, kind: "other", label: "Jalon",
        referenceDate: dateDe(jour(10)),
        schedules: {
          create: [
            { type: "recurrent", unit: "year", interval: 1, leadTimeDays: 7 },
            { type: "recurrent", unit: "year", interval: 1, leadTimeDays: 1 },
          ],
        },
      },
      select: { id: true },
    });
    await db.prisma.eventOccurrence.create({
      data: { eventId: e.id, userId: awa, occurrenceDate: dateDe(jour(10)), occurrenceYear: 2026 },
    });
    await prog.programmerRappels();

    const quand = (await filesDe("event_reminder"))
      .filter((n) => n.channel === "in_app")
      .map((n) => n.scheduledFor!.toISOString().slice(0, 10))
      .sort();
    expect(quand).toEqual([jour(3), jour(9)]);
  });

  /* On ne rattrape pas un rappel manqué. Programmer dans le passé le ferait
     partir immédiatement à l'envoi suivant — un « J-7 » reçu le jour même. */
  it("ne programme rien dans le passé", async () => {
    await echeance(2, 7);
    await prog.programmerRappels();
    const r = await filesDe("event_reminder");
    expect(r).toHaveLength(0);
    // Le jour même, lui, reste programmé : il n'est pas en retard.
    expect((await filesDe("event_day_of")).length).toBeGreaterThan(0);
  });

  // Le contrat commun : jamais une phrase composée, toujours une clé et des
  // paramètres. La langue d'interface peut changer après l'envoi.
  it("transporte une clé et des paramètres, jamais une phrase", async () => {
    await echeance(10, 3);
    await prog.programmerRappels();
    const n = await db.prisma.notification.findFirst({
      where: { type: "event_reminder" },
      select: { titleKey: true, bodyParams: true },
    });
    expect(n!.titleKey).toBe("notification.event_reminder");
    expect(n!.bodyParams).toMatchObject({ days: 3 });
    /* Le nom voyage AVEC la notification. Sans lui, la ligne dirait « une date
       approche » sans dire de qui — et on la lit souvent hors connexion, donc
       la résoudre côté client depuis personId ne suffirait pas. */
    expect(n!.bodyParams).toMatchObject({ person: "Valery" });
    // La nature suit : un « bonne fête » sur un anniversaire de décès est
    // impardonnable, et le client ne doit pas avoir à aller la chercher.
    expect(n!.bodyParams).toMatchObject({ nature: "happy" });
  });
  /* ─── MA PROPRE DATE ────────────────────────────────────────────────────────
   *
   * §13.1 du brief backend, et c'était le plus grave de la liste : le balayage
   * ne regardait pas `isSelf`, donc il souhaitait au titulaire son propre
   * anniversaire. Mot pour mot, par courriel, à Valentine, pour l'anniversaire
   * de Valentine :
   *
   *     « Une date pour Valentine approche »
   *     « Le 7 novembre 2026, dans sept jours. Le bon moment pour préparer un mot. »
   *
   * Un écran faux se corrige au prochain déploiement ; un courriel parti ne se
   * rattrape pas. C'est le seul point de la liste qui SORTAIT du produit. */
  describe("sur ma propre date", () => {
    it("n'émet jamais les natures d'un proche", async () => {
      await echeanceASoi(10, 3);
      await prog.programmerRappels();

      expect(await filesDe("event_reminder")).toHaveLength(0);
      expect(await filesDe("event_day_of")).toHaveLength(0);
    });

    it("émet ses deux natures à elle", async () => {
      await echeanceASoi(10, 3);
      await prog.programmerRappels();

      expect((await filesDe("own_date_reminder")).length).toBeGreaterThan(0);
      expect((await filesDe("own_date_day_of")).length).toBeGreaterThan(0);
    });

    /* LES DEUX FAMILLES COEXISTENT, et c'est la raison d'être des deux natures :
       ne pas vouloir qu'on vous rappelle votre propre anniversaire ne dit rien
       de celui de votre mère. Un drapeau sur `event_reminder` aurait éteint les
       deux ensemble. */
    it("laisse passer celle d'un proche le même jour", async () => {
      await echeanceASoi(10, 3);
      await echeance(10, 3);
      await prog.programmerRappels();

      expect((await filesDe("event_reminder")).length).toBeGreaterThan(0);
      expect((await filesDe("own_date_reminder")).length).toBeGreaterThan(0);
    });

    /* L'ÉTAT DE LA LISTE VOYAGE AVEC, et c'est lui qui choisit la phrase :
       préparer, partager, ou rien. Les faits partent bruts — le serveur
       n'envoie jamais une phrase composée. */
    it("dit qu'il n'y a pas encore de liste", async () => {
      await echeanceASoi(10, 3);
      await prog.programmerRappels();

      const n = await db.prisma.notification.findFirst({
        where: { type: "own_date_reminder" }, select: { titleKey: true, bodyParams: true },
      });
      expect(n!.titleKey).toBe("notification.own_date_reminder");
      expect(n!.bodyParams).toMatchObject({ wishCount: 0, isShared: false });
    });

    it("dit qu'une liste attend d'être partagée", async () => {
      const o = await echeanceASoi(10, 3);
      await listeSur(o, 3, false);
      await prog.programmerRappels();

      const n = await db.prisma.notification.findFirst({
        where: { type: "own_date_reminder" }, select: { bodyParams: true },
      });
      expect(n!.bodyParams).toMatchObject({ wishCount: 3, isShared: false });
    });

    it("dit qu'elle est partagée", async () => {
      const o = await echeanceASoi(10, 3);
      await listeSur(o, 2, true);
      await prog.programmerRappels();

      const n = await db.prisma.notification.findFirst({
        where: { type: "own_date_reminder" }, select: { bodyParams: true },
      });
      expect(n!.bodyParams).toMatchObject({ wishCount: 2, isShared: true });
    });

    /* UN LIEN RÉVOQUÉ NE COMPTE PAS. `WishlistShareLink.isActive` existe
       précisément pour qu'on puisse faire tourner un jeton sans perdre la
       liste ; compter les lignes sans regarder ce drapeau dirait « partagée »
       d'une liste que plus personne ne peut ouvrir, et ferait taire le seul
       rappel qui servait à quelque chose. */
    it("ne tient pas un lien révoqué pour un partage", async () => {
      const o = await echeanceASoi(10, 3);
      const l = await listeSur(o, 2, true);
      await db.prisma.wishlistShareLink.updateMany({
        where: { wishlistId: l }, data: { isActive: false },
      });
      await prog.programmerRappels();

      const n = await db.prisma.notification.findFirst({
        where: { type: "own_date_reminder" }, select: { bodyParams: true },
      });
      expect(n!.bodyParams).toMatchObject({ isShared: false });
    });

    /* LA ROUTE VISE LA LISTE quand elle existe : c'est là que le geste se fait.
       L'échéance sinon — d'où l'on en ouvre une. */
    it("mène à la liste quand il y en a une, à l'échéance sinon", async () => {
      const sans = await echeanceASoi(10, 3);
      await prog.programmerRappels();
      const avantListe = await db.prisma.notification.findFirst({
        where: { type: "own_date_day_of" }, select: { targetRoute: true },
      });
      expect(avantListe!.targetRoute).toBe(`/occurrences/${sans}`);

      await resetDatabase(db.prisma);
      const u = await db.prisma.user.create({
        data: {
          email: `${randomBytes(6).toString("hex")}@example.com`,
          username: `u${randomBytes(4).toString("hex")}`,
          referralCode: randomBytes(4).toString("hex").toUpperCase(),
        },
      });
      awa = u.id;
      const avec = await echeanceASoi(10, 3);
      const liste = await listeSur(avec, 1, false);
      await prog.programmerRappels();
      const apres = await db.prisma.notification.findFirst({
        where: { type: "own_date_day_of" }, select: { targetRoute: true },
      });
      expect(apres!.targetRoute).toBe(`/wishlists/${liste}`);
    });

    /* L'ÉTAT DE LA LISTE NE PART PAS SUR LA DATE D'UN PROCHE. Le poser partout
       ferait croire aux phrases des proches qu'elles ont un geste à proposer,
       alors qu'il n'y a rien à partager chez quelqu'un d'autre. */
    it("ne charge pas la date d'un proche de l'état d'une liste", async () => {
      await echeance(10, 3);
      await prog.programmerRappels();
      const n = await db.prisma.notification.findFirst({
        where: { type: "event_reminder" }, select: { bodyParams: true },
      });
      const params = n!.bodyParams as Record<string, unknown>;
      expect(params["wishCount"]).toBeUndefined();
      expect(params["isShared"]).toBeUndefined();
    });
  });
});
