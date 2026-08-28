import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import jwt from "jsonwebtoken";
import { randomBytes } from "node:crypto";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { NotificationService } from "../src/me/notification.service.js";
import { HomeService } from "../src/me/home.service.js";
import { OccurrenceService } from "../src/me/occurrence.service.js";
import { TenantRepository } from "../src/tenancy/tenant.repository.js";
import { AppModule } from "../src/app.module.js";
import { AppExceptionFilter } from "../src/common/errors.js";

const SECRET = "c2VjcmV0LWRlLXRlc3QtMzItb2N0ZXRzLWV4YWN0ZW1lbnQ=";
const PEPPER = "dGVzdC1wZXBwZXItMzItb2N0ZXRzLWV4YWN0ZW1lbnQhIQ==";

const JOUR = 86_400_000;
const ilYA = (jours: number): Date => new Date(Date.now() - jours * JOUR);
const dans = (jours: number): Date => new Date(Date.now() + jours * JOUR);

describe("le centre de notifications", () => {
  let db: TestDb;
  let centre: NotificationService;
  let accueil: HomeService;
  let awa: string;
  let bila: string;

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

  // Une ligne de file, telle que la posent ProgrammationService et
  // RelancesService : un canal, une clé, une échéance.
  let compteur = 0;
  const poser = async (
    userId: string,
    quoi: Partial<{
      channel: "in_app" | "email" | "push";
      scheduledFor: Date | null;
      readAt: Date | null;
      titleKey: string;
      targetRoute: string;
      personId: string;
      eventOccurrenceId: string;
      type: "event_reminder" | "digest" | "activation_first_person";
    }> = {},
  ): Promise<string> => {
    compteur += 1;
    const n = await db.prisma.notification.create({
      data: {
        userId,
        type: quoi.type ?? "event_reminder",
        channel: quoi.channel ?? "in_app",
        titleKey: quoi.titleKey ?? "notification.event_reminder",
        bodyParams: { days: 7, person: "Célarine" },
        targetRoute: quoi.targetRoute ?? "/occurrences/x",
        ...(quoi.personId ? { personId: quoi.personId } : {}),
        ...(quoi.eventOccurrenceId ? { eventOccurrenceId: quoi.eventOccurrenceId } : {}),
        dedupeKey: `cle-${compteur}`,
        scheduledFor: quoi.scheduledFor === undefined ? ilYA(1) : quoi.scheduledFor,
        readAt: quoi.readAt ?? null,
      },
    });
    return n.id;
  };

  beforeAll(async () => { db = await withDatabase(); }, 120_000);
  afterAll(async () => { await db.close(); });
  beforeEach(async () => {
    await resetDatabase(db.prisma);
    const depot = new TenantRepository(db.prisma as never);
    centre = new NotificationService(depot, db.prisma as never);
    accueil = new HomeService(db.prisma as never, new OccurrenceService(depot, db.prisma as never));
    awa = await compte();
    bila = await compte();
  });

  // ── Ce que le centre contient ────────────────────────────────────────────

  it("rend la clé et les paramètres, jamais une phrase composée", async () => {
    await poser(awa);
    const [e] = (await centre.list(awa, {})).items;
    expect(e?.titleKey).toBe("notification.event_reminder");
    expect(e?.bodyParams).toEqual({ days: 7, person: "Célarine" });
    // Le serveur ne connaît pas la langue de qui lira : un titre composé ici
    // resterait dans la langue d'hier après un changement de préférence.
    expect(e).not.toHaveProperty("title");
  });

  /* Le cloisonnement. La file est indexée par [userId, readAt] et rien
     n'oblige un `where` à porter le compte : une lecture qui l'oublie rend le
     centre de tout le monde, et personne ne s'en aperçoit tant que la base de
     test n'a qu'un compte. */
  it("ne rend jamais la notification d'un autre compte", async () => {
    await poser(bila);
    expect((await centre.list(awa, {})).items).toEqual([]);
    expect((await centre.list(awa, {})).unreadCount).toBe(0);
  });

  /* LE piège de ce chemin. `Notification` est un registre d'ENVOIS autant
     qu'une file de centre : un même fait y pose une ligne par canal. Sans le
     filtre, le même rappel s'afficherait trois fois — une pour le centre, une
     pour le courrier parti, une pour la poussée. */
  it("ne rend que le canal in_app : le courrier et la poussée sont des envois", async () => {
    await poser(awa, { channel: "in_app" });
    await poser(awa, { channel: "email" });
    await poser(awa, { channel: "push" });

    const page = await centre.list(awa, {});
    expect(page.items).toHaveLength(1);
    expect(page.unreadCount).toBe(1);
  });

  /* La programmation garnit la file jusqu'à un mois d'avance : un rappel J-7
     pour une date dans cinq semaines existe en base bien avant d'être dû. Sans
     la borne d'échéance, le centre annoncerait « c'est dans sept jours » cinq
     semaines trop tôt, et la pastille compterait comme non lu ce que personne
     ne peut encore lire. */
  it("ne rend pas un rappel programmé pour plus tard", async () => {
    await poser(awa, { scheduledFor: dans(10) });
    const page = await centre.list(awa, {});
    expect(page.items).toEqual([]);
    expect(page.unreadCount).toBe(0);
  });

  // `scheduled_for` nul veut dire « tout de suite » — c'est la convention
  // d'EnvoiService, et les relances posent leurs lignes ainsi.
  it("rend une entrée sans échéance : nul vaut tout de suite", async () => {
    await poser(awa, { scheduledFor: null });
    expect((await centre.list(awa, {})).items).toHaveLength(1);
  });

  /* L'ordre vient de l'ÉCHÉANCE, pas de la création. Un passage de
     programmation écrit d'un coup les rappels de toutes les échéances du
     mois : leurs `created_at` sont identiques à la seconde près, et leur ordre
     relatif est celui dans lequel la base a rendu les échéances — un détail
     interne. Trier dessus mettrait le rappel d'il y a une semaine au-dessus de
     celui de ce matin. */
  it("range par échéance, pas par date d'écriture", async () => {
    const vieille = await poser(awa, { scheduledFor: ilYA(7), titleKey: "a" });
    const recente = await poser(awa, { scheduledFor: ilYA(1), titleKey: "b" });
    // Écrites dans cet ordre : la vieille échéance a le `created_at` le plus
    // ancien, donc l'ordre par création donnerait le même résultat par hasard.
    // On écrit ensuite une TROISIÈME ligne, plus récente en base mais plus
    // ancienne en échéance : c'est elle qui départage les deux tris.
    const tardive = await poser(awa, { scheduledFor: ilYA(30), titleKey: "c" });

    const ids = (await centre.list(awa, {})).items.map((e) => e.id);
    expect(ids).toEqual([recente, vieille, tardive]);
  });

  // L'entrée est datée de son échéance : servir `created_at` afficherait
  // « il y a 28 jours » sur un rappel arrivé ce matin.
  it("date l'entrée de son échéance, pas de son écriture", async () => {
    const quand = ilYA(2);
    await poser(awa, { scheduledFor: quand });
    const [e] = (await centre.list(awa, {})).items;
    expect(e?.notifiedAt).toBe(quand.toISOString());
  });

  /* Chaque entrée mène quelque part (§3.13). La route seule obligerait le
     client à découper `/occurrences/<uuid>` pour naviguer : le jour où la
     route change, il ouvre des écrans vides sans qu'aucun test ne tombe. */
  it("porte la cible brute en plus de la route", async () => {
    const p = await db.prisma.person.create({ data: { userId: awa, displayName: "Célarine" } });
    await poser(awa, { personId: p.id, targetRoute: `/persons/${p.id}` });
    const [e] = (await centre.list(awa, {})).items;
    expect(e?.personId).toBe(p.id);
    expect(e?.targetRoute).toBe(`/persons/${p.id}`);
  });

  /* `onDelete: SetNull` sur les deux relations : un proche supprimé vide
     `personId` mais laisse `targetRoute` pointer sur sa fiche disparue.
     L'entrée doit rester lisible — c'est une trace de ce qui a été signalé —
     et le client doit pouvoir constater que la cible n'existe plus au lieu
     d'ouvrir un écran mort. */
  it("survit à la suppression de sa cible, en le disant", async () => {
    const p = await db.prisma.person.create({ data: { userId: awa, displayName: "Célarine" } });
    await poser(awa, { personId: p.id, targetRoute: `/persons/${p.id}` });
    await db.prisma.person.delete({ where: { id: p.id } });

    const [e] = (await centre.list(awa, {})).items;
    expect(e).toBeDefined();
    expect(e?.personId).toBeNull();
  });

  /* Les cinq natures `activation_*` existent en base et les relances les
     posent en `in_app`. Elles manquaient à l'énumération du contrat : la file
     se remplissait d'entrées qu'aucune lecture ne savait rendre. Un type
     absent n'échoue pas à l'écriture, il échoue à la LECTURE. */
  it("rend les relances d'activation, que le contrat ignorait", async () => {
    await poser(awa, { type: "activation_first_person", titleKey: "notification.activation_first_person" });
    const [e] = (await centre.list(awa, {})).items;
    expect(e?.type).toBe("activation_first_person");
  });

  // ── La pastille ──────────────────────────────────────────────────────────

  /* La cloche de l'en-tête et la liste du centre doivent compter la même
     chose. Un `where` recopié à la main comptait les lignes `email` et `push`
     et les rappels programmés d'avance : la cloche annonçait des éléments que
     le centre ne montrait pas, et qu'aucun geste ne pouvait éteindre. */
  it("la pastille de l'accueil compte exactement ce que le centre montre", async () => {
    await poser(awa, { channel: "in_app" });
    await poser(awa, { channel: "email" });
    await poser(awa, { channel: "push" });
    await poser(awa, { scheduledFor: dans(10) });
    await poser(awa, { readAt: ilYA(1) });

    const page = await centre.list(awa, {});
    const nonLues = page.items.filter((e) => e.readAt === null).length;
    expect((await accueil.get(awa)).unreadNotifications).toBe(nonLues);
    expect(page.unreadCount).toBe(nonLues);
  });

  // ── Marquer comme lu ─────────────────────────────────────────────────────

  it("marque une entrée nommée, et elle seule", async () => {
    const lue = await poser(awa);
    await poser(awa);

    const { unreadCount } = await centre.marquerLues(awa, { ids: [lue] });
    expect(unreadCount).toBe(1);
    const relue = (await centre.list(awa, {})).items.find((e) => e.id === lue);
    expect(relue?.readAt).not.toBeNull();
  });

  /* L'idempotence, sur l'ÉTAT : rejouer l'appel ne change rien. C'est ce qui
     permet au client de retenter après une coupure réseau sans se demander si
     le premier essai est passé. */
  it("marquer deux fois ne change rien", async () => {
    const id = await poser(awa);
    const premier = await centre.marquerLues(awa, { ids: [id] });
    const second = await centre.marquerLues(awa, { ids: [id] });
    expect(second).toEqual(premier);
    expect(second.unreadCount).toBe(0);
  });

  /* La date de PREMIÈRE lecture est le fait ; la dernière ouverture n'en est
     pas un. Sans le `readAt: null` dans le filtre d'écriture, une notification
     lue mardi se relirait « lue vendredi », et le centre mentirait sur ce qui
     s'est passé. */
  it("ne repousse pas la date d'une notification déjà lue", async () => {
    const id = await poser(awa);
    await centre.marquerLues(awa, { ids: [id] });
    const premiere = (await db.prisma.notification.findUniqueOrThrow({ where: { id } })).readAt;

    await centre.marquerLues(awa, { all: true });
    const apres = (await db.prisma.notification.findUniqueOrThrow({ where: { id } })).readAt;
    expect(apres?.toISOString()).toBe(premiere?.toISOString());
  });

  // Une notification lue ne redevient jamais non lue : rien n'efface `readAt`.
  it("une notification lue ne redevient pas non lue", async () => {
    const quand = ilYA(3);
    const id = await poser(awa, { readAt: quand });
    await centre.marquerLues(awa, { all: true });
    const ligne = await db.prisma.notification.findUniqueOrThrow({ where: { id } });
    expect(ligne.readAt?.toISOString()).toBe(quand.toISOString());
    expect((await centre.list(awa, {})).unreadCount).toBe(0);
  });

  /* 404, jamais 403 : la notification d'autrui n'existe pas pour le demandeur.
     Le contrôle ne peut pas se déduire du nombre de lignes touchées — une
     notification déjà lue en donne zéro elle aussi, et confondre les deux
     ferait échouer le rejeu. */
  it("rend 404 sur l'identifiant d'un autre compte, sans rien marquer", async () => {
    const sienne = await poser(bila);
    await expect(centre.marquerLues(awa, { ids: [sienne] })).rejects.toMatchObject({
      code: "not_found",
    });
    const ligne = await db.prisma.notification.findUniqueOrThrow({ where: { id: sienne } });
    expect(ligne.readAt).toBeNull();
  });

  /* Une ligne `email` n'a jamais été rendue par le centre : la marquer lue
     n'aurait aucun sens, et l'accepter en silence apprendrait au client
     qu'un identifiant inventé est sans conséquence. */
  it("rend 404 sur une ligne que le centre n'a jamais montrée", async () => {
    const courrier = await poser(awa, { channel: "email" });
    await expect(centre.marquerLues(awa, { ids: [courrier] })).rejects.toMatchObject({
      code: "not_found",
    });
  });

  // Le même identifiant deux fois est une maladresse de client, pas une entrée
  // introuvable : le contrôle d'appartenance compare des longueurs, et sans
  // dédoublonnage il prendrait l'un pour l'autre.
  it("accepte le même identifiant répété", async () => {
    const id = await poser(awa);
    await expect(centre.marquerLues(awa, { ids: [id, id] })).resolves.toEqual({ unreadCount: 0 });
  });

  /* « Tout » ne marque que ce qui est DÛ. Un rappel programmé pour la semaine
     prochaine reste non lu : personne n'a pu le lire, et l'éteindre ferait
     qu'il n'apparaîtrait jamais en pastille le jour venu. */
  it("marquer tout n'éteint pas ce qui n'est pas encore arrivé", async () => {
    await poser(awa);
    const plusTard = await poser(awa, { scheduledFor: dans(5) });

    await centre.marquerLues(awa, { all: true });
    const ligne = await db.prisma.notification.findUniqueOrThrow({ where: { id: plusTard } });
    expect(ligne.readAt).toBeNull();
  });

  // Marquer tout ne franchit pas la frontière des comptes.
  it("marquer tout ne touche pas le centre d'un autre", async () => {
    const sienne = await poser(bila);
    await poser(awa);
    await centre.marquerLues(awa, { all: true });
    expect((await db.prisma.notification.findUniqueOrThrow({ where: { id: sienne } })).readAt).toBeNull();
  });

  // ── La pagination ────────────────────────────────────────────────────────

  /* Ce que le curseur garantit et qu'un `offset` ne garantit pas : parcourir
     la file entière rend chaque entrée UNE fois. Avec un rang, une entrée
     insérée entre deux pages décalerait tout ce qui suit. */
  it("parcourt toute la file sans perdre ni répéter d'entrée", async () => {
    const attendus: string[] = [];
    for (let i = 0; i < 25; i += 1) attendus.push(await poser(awa, { scheduledFor: ilYA(i + 1) }));

    const vus: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await centre.list(awa, { limit: 7, ...(cursor ? { cursor } : {}) });
      vus.push(...page.items.map((e) => e.id));
      cursor = page.nextCursor ?? undefined;
    } while (cursor !== undefined);

    expect(vus).toEqual(attendus);
    expect(new Set(vus).size).toBe(attendus.length);
  });

  /* Le curseur nul dit « il n'y a plus rien », pas « il en reste peut-être ».
     On demande une ligne de plus que la page pour le savoir : sans ça, une
     file d'exactement une page rendrait un curseur menant à une page vide, et
     l'écran afficherait un « voir plus » qui ne montre rien. */
  it("ne rend pas de curseur quand la file s'arrête pile sur une page", async () => {
    for (let i = 0; i < 3; i += 1) await poser(awa, { scheduledFor: ilYA(i + 1) });
    expect((await centre.list(awa, { limit: 3 })).nextCursor).toBeNull();
  });

  // Deux entrées de MÊME échéance ne doivent pas s'échanger entre deux pages :
  // sans départage stable, le curseur en perdrait une et répéterait l'autre.
  it("départage les entrées de même échéance", async () => {
    const meme = ilYA(2);
    for (let i = 0; i < 6; i += 1) await poser(awa, { scheduledFor: meme });

    const premiere = await centre.list(awa, { limit: 3 });
    const suivante = await centre.list(awa, { limit: 3, cursor: premiere.nextCursor as string });
    const tous = [...premiere.items, ...suivante.items].map((e) => e.id);
    expect(new Set(tous).size).toBe(6);
  });
});

describe("le centre de notifications — HTTP de bout en bout", () => {
  let db: TestDb;
  let app: INestApplication;
  let baseUrl: string;
  let awa: string;
  let token: string;
  let precedent: Record<string, string | undefined>;

  beforeAll(async () => {
    db = await withDatabase();
    precedent = {
      DATABASE_URL: process.env.DATABASE_URL,
      OTP_PEPPER: process.env.OTP_PEPPER,
      JWT_SECRET: process.env.JWT_SECRET,
      LEHNO_MAIL_CONSOLE: process.env.LEHNO_MAIL_CONSOLE,
    };
    process.env.DATABASE_URL = db.url;
    process.env.OTP_PEPPER = PEPPER;
    process.env.JWT_SECRET = SECRET;
    process.env.LEHNO_MAIL_CONSOLE = "1";

    app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
    app.setGlobalPrefix("v1");
    app.useGlobalFilters(new AppExceptionFilter());
    await app.listen(0);
    baseUrl = await app.getUrl();
  }, 120_000);

  afterAll(async () => {
    await app.close();
    await db.close();
    for (const [cle, valeur] of Object.entries(precedent)) {
      if (valeur === undefined) delete process.env[cle];
      else process.env[cle] = valeur;
    }
  });

  beforeEach(async () => {
    await resetDatabase(db.prisma);
    const u = await db.prisma.user.create({
      data: { email: "awa@example.com", username: "awa_http", referralCode: "AWAHTTP" },
    });
    awa = u.id;
    token = jwt.sign({ sub: awa }, SECRET, { algorithm: "HS256", expiresIn: 900 });
  });

  // Recalculé à chaque usage : `token` est posé par `beforeEach`, et une
  // constante figée au chargement du module capturerait la valeur d'avant.
  const auth = (): Record<string, string> => ({ authorization: `Bearer ${token}` });

  // AuthGuard et le `.strict()` du corps ne s'éprouvent qu'à la route réelle :
  // le service, appelé directement, ne les voit jamais passer.
  it("refuse une lecture sans jeton", async () => {
    const r = await fetch(`${baseUrl}/v1/me/notifications`);
    expect(r.status).toBe(401);
  });

  it("rend la page du centre", async () => {
    await db.prisma.notification.create({
      data: {
        userId: awa, type: "digest", channel: "in_app", titleKey: "notification.digest",
        dedupeKey: "http-1", scheduledFor: ilYA(1),
      },
    });
    const r = await fetch(`${baseUrl}/v1/me/notifications`, { headers: { authorization: `Bearer ${token}` } });
    expect(r.status).toBe(200);
    const corps = (await r.json()) as { items: unknown[]; nextCursor: string | null; unreadCount: number };
    expect(corps.items).toHaveLength(1);
    expect(corps.unreadCount).toBe(1);
    expect(corps.nextCursor).toBeNull();
  });

  /* Le corps vide est le piège du marquage : un `{}` qui vaudrait « tout »
     ferait qu'un client dont la sélection est restée vide éteindrait la
     pastille de quelqu'un qui n'a rien lu. */
  it("refuse un marquage qui ne dit pas ce qu'il marque", async () => {
    const r = await fetch(`${baseUrl}/v1/me/notifications/read`, {
      method: "POST",
      headers: { "content-type": "application/json", ...auth() },
      body: JSON.stringify({}),
    });
    expect(r.status).toBe(400);
    expect(((await r.json()) as { code: string }).code).toBe("validation_failed");
  });

  // 200, pas 201 : rien n'est créé, une date est posée. Nest rendrait 201 par
  // défaut sur un POST, et le client attendrait un `Location` inexistant.
  it("répond 200 au marquage, avec l'état et non le nombre de lignes", async () => {
    await db.prisma.notification.create({
      data: {
        userId: awa, type: "digest", channel: "in_app", titleKey: "notification.digest",
        dedupeKey: "http-2", scheduledFor: ilYA(1),
      },
    });
    const r = await fetch(`${baseUrl}/v1/me/notifications/read`, {
      method: "POST",
      headers: { "content-type": "application/json", ...auth() },
      body: JSON.stringify({ all: true }),
    });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ unreadCount: 0 });
  });

  // Un curseur qui n'est pas un identifiant est un 400 nommé, pas une erreur
  // de base remontée telle quelle au client.
  it("refuse un curseur qui n'est pas un identifiant", async () => {
    const r = await fetch(`${baseUrl}/v1/me/notifications?cursor=pas-un-uuid`, { headers: auth() });
    expect(r.status).toBe(400);
  });
});
