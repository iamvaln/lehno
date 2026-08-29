import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { AppModule } from "../src/app.module.js";
import { AppExceptionFilter } from "../src/common/errors.js";
import { AdminTokenService } from "../src/admin/admin-token.service.js";
import { compteDetailSchema, pageComptesSchema } from "@lehno/contracts";

const PEPPER = "dGVzdC1wZXBwZXItMzItb2N0ZXRzLWV4YWN0ZW1lbnQhIQ==";
const SECRET = "c2VjcmV0LWRlLXRlc3QtMzItb2N0ZXRzLWV4YWN0ZW1lbnQ=";
const SECRET_ADMIN = "Y2xlLWFkbWluLWRlLXRlc3QtMzItb2N0ZXRzLWljaSEh";

describe("administration — les comptes", () => {
  let db: TestDb;
  let app: INestApplication;
  let baseUrl: string;
  let jetons: AdminTokenService;

  beforeAll(async () => {
    db = await withDatabase();
    process.env.DATABASE_URL = db.url;
    process.env.OTP_PEPPER = PEPPER;
    process.env.JWT_SECRET = SECRET;
    process.env.ADMIN_JWT_SECRET = SECRET_ADMIN;
    process.env.LEHNO_MAIL_CONSOLE = "1";
    app = await NestFactory.create(AppModule, { logger: false });
    app.setGlobalPrefix("v1");
    app.useGlobalFilters(new AppExceptionFilter());
    await app.listen(0);
    baseUrl = await app.getUrl();
    jetons = app.get(AdminTokenService);
  }, 180_000);

  beforeEach(async () => { await resetDatabase(db.prisma); });
  afterAll(async () => { await app?.close(); await db.close(); });

  const session = async (role: "support" | "admin") => {
    const compte = await db.prisma.admin.create({ data: { email: `${role}@lehno.app`, role } });
    const { accessToken } = await jetons.ouvrir(compte.id);
    return { compte, entete: { authorization: `Bearer ${accessToken}` } };
  };

  const creerUtilisateur = (n: number, over: Record<string, unknown> = {}) =>
    db.prisma.user.create({
      data: { email: `u${n}@example.com`, username: `u${n}`, referralCode: `R${n}`, ...over },
    });

  const lister = (entete: Record<string, string>, requete = "") =>
    fetch(`${baseUrl}/v1/admin/users${requete}`, { headers: entete });

  // Le contrat est la seule chose que les deux côtés partagent. Tant que rien ne
  // le vérifiait, le serveur a servi « username » et « status » là où l'outil
  // attendait « pseudo » et « etat » — deux mondes compilés séparément, chacun
  // convaincu d'avoir raison. Ces deux tests-là sont la charnière : ils
  // échouent le jour où l'un des deux bouge sans l'autre.
  it("la page de comptes suit le contrat publié, au champ près", async () => {
    await creerUtilisateur(1, { username: "awa", email: "awa@exemple.cm" });
    const { entete } = await session("support");

    const corps = await (await lister(entete)).json();

    const valide = pageComptesSchema.safeParse(corps);
    expect(valide.success ? null : valide.error.issues).toBeNull();
  });

  it("la fiche d'un compte suit le contrat publié, au champ près", async () => {
    const u = await creerUtilisateur(1, { username: "awa", email: "awa@exemple.cm" });
    const { entete } = await session("support");

    const corps = await (await fetch(`${baseUrl}/v1/admin/users/${u.id}`, { headers: entete })).json();

    const valide = compteDetailSchema.safeParse(corps);
    expect(valide.success ? null : valide.error.issues).toBeNull();
  });

  // Les états se disent dans la langue du contrat, pas dans celle de la base.
  // Sans ça, l'écran devrait traduire un enum Prisma — et le jour où Prisma
  // renomme une valeur, c'est l'affichage qui casse, pas le typage.
  it("rend les états dans les termes du contrat", async () => {
    await creerUtilisateur(1, { username: "awa", email: "awa@exemple.cm", status: "suspended" });
    const { entete } = await session("support");

    const corps = (await (await lister(entete)).json()) as { items: { etat: string }[] };

    expect(corps.items[0]?.etat).toBe("suspendu");
  });

  // Le solde est la somme des mouvements : aucune colonne de solde n'est
  // stockée, donc aucune ne peut se désynchroniser. Le calculer ici plutôt que
  // le lire est la conséquence directe de ce choix de modèle.
  it("rend le solde de crédits, somme signée des mouvements", async () => {
    const u = await creerUtilisateur(1, { username: "awa", email: "awa@exemple.cm" });
    await db.prisma.creditTransaction.createMany({
      data: [
        { userId: u.id, type: "grant", source: "signup_grant", amount: 5 },
        { userId: u.id, type: "purchase", source: "purchase", amount: 20 },
        { userId: u.id, type: "consumption", source: "consumption", amount: -3 },
      ],
    });
    const { entete } = await session("support");

    const corps = (await (await lister(entete)).json()) as { items: { credits: number | null }[] };

    expect(corps.items[0]?.credits).toBe(22);
  });

  // `type` dit ce que le mouvement est, `source` d'où il vient. Un octroi
  // d'inscription et un bonus de parrainage sont tous deux des « grant » et se
  // ressemblent — « ce sont pourtant deux gestes distincts dont l'un se
  // mérite ». La fiche les compte ensemble dans « offerts », parce que la
  // question qu'elle pose est « ce compte a-t-il payé ou a-t-il reçu ». Ce
  // test fixe ce choix : sans lui, il n'est qu'une conséquence non dite du
  // calcul, et la première personne qui voudra le nuancer ne saura pas s'il
  // était voulu.
  it("compte l'inscription et le parrainage ensemble dans les crédits offerts", async () => {
    const u = await creerUtilisateur(1, { username: "awa", email: "awa@exemple.cm" });
    await db.prisma.creditTransaction.createMany({
      data: [
        { userId: u.id, type: "grant", source: "signup_grant", amount: 5 },
        { userId: u.id, type: "grant", source: "referral_bonus", amount: 3 },
      ],
    });
    const { entete } = await session("support");

    const corps = (await (await fetch(`${baseUrl}/v1/admin/users/${u.id}`, { headers: entete })).json()) as {
      credits: { solde: number; achetes: number; offerts: number };
    };

    expect(corps.credits).toEqual({ solde: 8, achetes: 0, offerts: 8 });
  });

  // La source ne change pas le solde, et c'est ce qu'on veut vérifier : une
  // recharge manuelle et un achat par l'application sont deux chemins vers le
  // même crédit, et le solde ne doit pas dépendre de celui qu'on a pris.
  it("le solde ne dépend pas du chemin par lequel le crédit est arrivé", async () => {
    const u = await creerUtilisateur(1, { username: "awa", email: "awa@exemple.cm" });
    await db.prisma.creditTransaction.createMany({
      data: [
        { userId: u.id, type: "purchase", source: "purchase", amount: 10 },
        { userId: u.id, type: "purchase", source: "manual_topup", amount: 10 },
      ],
    });
    const { entete } = await session("support");

    const corps = (await (await fetch(`${baseUrl}/v1/admin/users/${u.id}`, { headers: entete })).json()) as {
      credits: { solde: number; achetes: number };
    };

    expect(corps.credits.solde).toBe(20);
    expect(corps.credits.achetes).toBe(20);
  });

  it("un compte sans mouvement a zéro, pas « inconnu »", async () => {
    await creerUtilisateur(1, { username: "awa", email: "awa@exemple.cm" });
    const { entete } = await session("support");

    const corps = (await (await lister(entete)).json()) as { items: { credits: number | null }[] };

    expect(corps.items[0]?.credits).toBe(0);
  });

  // La fiche distingue ce qui a été acheté de ce qui a été offert : c'est la
  // différence entre un compte qui paie et un compte qu'on entretient.
  it("la fiche sépare le solde, les achats et les dons", async () => {
    const u = await creerUtilisateur(1, { username: "awa", email: "awa@exemple.cm" });
    await db.prisma.creditTransaction.createMany({
      data: [
        { userId: u.id, type: "grant", source: "signup_grant", amount: 5 },
        { userId: u.id, type: "purchase", source: "purchase", amount: 20 },
        { userId: u.id, type: "consumption", source: "consumption", amount: -3 },
      ],
    });
    const { entete } = await session("support");

    const corps = (await (await fetch(`${baseUrl}/v1/admin/users/${u.id}`, { headers: entete })).json()) as {
      credits: { solde: number; achetes: number; offerts: number } | null;
    };

    expect(corps.credits).toEqual({ solde: 22, achetes: 20, offerts: 5 });
  });

  it("refuse sans session", async () => {
    expect((await fetch(`${baseUrl}/v1/admin/users`)).status).toBe(401);
  });

  it("rend une page à curseur, sans total", async () => {
    for (let i = 0; i < 3; i += 1) await creerUtilisateur(i);
    const { entete } = await session("support");

    const corps = (await (await lister(entete)).json()) as Record<string, unknown>;

    expect(Array.isArray(corps.items)).toBe(true);
    expect(corps).toHaveProperty("nextCursor");
    // Une API à curseur ne connaît pas de total, et l'interface s'en tient donc
    // à « Précédent · Suivant ». Servir un total ici rouvrirait la question.
    expect(corps).not.toHaveProperty("total");
  });

  it("le curseur ramène la suite, sans répéter ni sauter", async () => {
    for (let i = 0; i < 5; i += 1) await creerUtilisateur(i);
    const { entete } = await session("support");

    const p1 = (await (await lister(entete, "?limit=2")).json()) as { items: { id: string }[]; nextCursor: string | null };
    expect(p1.items).toHaveLength(2);
    expect(p1.nextCursor).toBeTypeOf("string");

    const p2 = (await (await lister(entete, `?limit=2&cursor=${p1.nextCursor}`)).json()) as { items: { id: string }[] };
    const vus = [...p1.items, ...p2.items].map((u) => u.id);
    expect(new Set(vus).size).toBe(vus.length);
  });

  it("filtre par état", async () => {
    await creerUtilisateur(1);
    await creerUtilisateur(2, { status: "suspended" });
    const { entete } = await session("support");

    const corps = (await (await lister(entete, "?status=suspended")).json()) as { items: { pseudo: string }[] };
    expect(corps.items.map((u) => u.pseudo)).toEqual(["u2"]);
  });

  it("cherche par pseudo ou adresse", async () => {
    await creerUtilisateur(1, { username: "awa", email: "awa@example.com" });
    await creerUtilisateur(2, { username: "valery", email: "valery@example.com" });
    const { entete } = await session("support");

    const corps = (await (await lister(entete, "?q=awa")).json()) as { items: { pseudo: string }[] };
    expect(corps.items.map((u) => u.pseudo)).toEqual(["awa"]);
  });

  // Le cloisonnement tient en administration : consulter un compte donne son
  // état et ses volumétries, jamais le contenu de ses fiches ni de ses notes.
  it("le détail rend des volumétries, jamais du contenu", async () => {
    const u = await creerUtilisateur(1);
    const p = await db.prisma.person.create({ data: { userId: u.id, displayName: "Awa Diop" } });
    await db.prisma.note.create({ data: { personId: p.id, content: "Elle a parlé d'un cours de céramique" } });
    const { entete } = await session("support");

    const res = await fetch(`${baseUrl}/v1/admin/users/${u.id}`, { headers: entete });
    expect(res.status).toBe(200);
    const texte = await res.text();

    expect(JSON.parse(texte).volumetrie).toMatchObject({ proches: 1, notes: 1 });
    // Ni le nom du proche, ni un mot de la note ne franchissent la frontière.
    expect(texte).not.toContain("Awa Diop");
    expect(texte).not.toContain("céramique");
  });

  it("un compte inconnu rend 404", async () => {
    const { entete } = await session("support");
    const res = await fetch(`${baseUrl}/v1/admin/users/00000000-0000-0000-0000-000000000000`, { headers: entete });
    expect(res.status).toBe(404);
  });

  const changer = (entete: Record<string, string>, id: string, corps: unknown) =>
    fetch(`${baseUrl}/v1/admin/users/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", ...entete },
      body: JSON.stringify(corps),
    });

  it("suspendre exige un motif, et n'écrit rien sans lui", async () => {
    const u = await creerUtilisateur(1);
    const { entete } = await session("support");

    const res = await changer(entete, u.id, { status: "suspended" });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect((await db.prisma.user.findUniqueOrThrow({ where: { id: u.id } })).status).toBe("active");
    expect(await db.prisma.auditLog.count()).toBe(0);
  });

  // « Suspendre ou rétablir un compte » appartient au support (ux-admin §6) :
  // c'est le geste de l'assistance quotidienne, il ne demande pas un admin.
  it("un support suspend, et le journal garde l'état quitté", async () => {
    const u = await creerUtilisateur(1);
    const { compte, entete } = await session("support");

    const res = await changer(entete, u.id, {
      status: "suspended", reason: "Contenu signalé à répétition",
      reasonCode: "third_party_report",
    });
    expect(res.status).toBe(200);

    expect((await db.prisma.user.findUniqueOrThrow({ where: { id: u.id } })).status).toBe("suspended");
    const trace = await db.prisma.auditLog.findFirstOrThrow();
    expect(trace.actorId).toBe(compte.id);
    expect(trace.action).toBe("user_status_update");
    expect(trace.targetId).toBe(u.id);
    expect(trace.metadata).toMatchObject({ from: "active", to: "suspended" });
  });

  it("rétablir remet le compte actif", async () => {
    const u = await creerUtilisateur(1, { status: "suspended" });
    const { entete } = await session("support");

    await changer(entete, u.id, { status: "active", reason: "Signalement infondé après examen" });
    expect((await db.prisma.user.findUniqueOrThrow({ where: { id: u.id } })).status).toBe("active");
  });

  // Effacer sans attendre la fin du délai de grâce est réservé à l'admin
  // (ux-admin §6). Le support traite les suppressions, il ne les précipite pas.
  it("un support ne peut pas marquer un compte effacé", async () => {
    const u = await creerUtilisateur(1, { status: "pending_deletion" });
    const { entete } = await session("support");

    const res = await changer(entete, u.id, { status: "deleted", reason: "Demande du titulaire par courriel" });
    expect(res.status).toBe(403);
    expect((await db.prisma.user.findUniqueOrThrow({ where: { id: u.id } })).status).toBe("pending_deletion");
  });

  /* Suspendre PROPOSE des motifs ; rétablir n'en propose aucun. C'est le même
     `user_status_update` au journal, et deux gestes différents — la raison pour
     laquelle les motifs se rangent par geste et non par action.

     Le premier cas est celui qui rend le câblage obligatoire : sans lui, un
     geste qu'on oublie de brancher continuerait d'écrire une phrase libre. */
  it("refuse une suspension sans code de motif", async () => {
    const u = await creerUtilisateur(1);
    const { entete } = await session("support");

    const res = await changer(entete, u.id, {
      status: "suspended", reason: "Contenu signalé à répétition",
    });
    expect(res.status).toBe(422);
    expect((await db.prisma.user.findUniqueOrThrow({ where: { id: u.id } })).status).toBe("active");
    expect(await db.prisma.auditLog.count()).toBe(0);
  });

  it("accepte un rétablissement sans code : ce geste n'en propose pas", async () => {
    const u = await creerUtilisateur(1, { status: "suspended" });
    const { entete } = await session("support");

    const res = await changer(entete, u.id, { status: "active", reason: "Signalement infondé après examen" });
    expect(res.status).toBe(200);
  });

  /* LE cas qui ne se verrait pas autrement : le code existe, il est actif,
     mais il appartient à `account_erase`. On vérifie d'abord qu'il existe —
     sans quoi ce cas passerait pour « code inconnu » et n'éprouverait rien. */
  it("refuse un code emprunté à un autre geste", async () => {
    const u = await creerUtilisateur(1);
    const { entete } = await session("support");

    const emprunte = await db.prisma.auditReasonScope.findFirstOrThrow({
      where: { geste: "account_erase", reason: { code: "test_account", isActive: true } },
    });
    expect(emprunte.geste).toBe("account_erase");

    const res = await changer(entete, u.id, {
      status: "suspended", reason: "Contenu signalé à répétition",
      reasonCode: "test_account",
    });
    expect(res.status).toBe(422);
    expect(await db.prisma.auditLog.count()).toBe(0);
  });

  it("garde le code à côté de la phrase", async () => {
    const u = await creerUtilisateur(1);
    const { entete } = await session("support");

    await changer(entete, u.id, {
      status: "suspended", reason: "Contenu signalé à répétition",
      reasonCode: "third_party_report",
    });
    const trace = await db.prisma.auditLog.findFirstOrThrow();
    expect(trace.reasonCode).toBe("third_party_report");
    expect(trace.reason).toBe("Contenu signalé à répétition");
  });
});
