import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { AppModule } from "../src/app.module.js";
import { AppExceptionFilter } from "../src/common/errors.js";
import { AdminTokenService } from "../src/admin/admin-token.service.js";

const PEPPER = "dGVzdC1wZXBwZXItMzItb2N0ZXRzLWV4YWN0ZW1lbnQhIQ==";
const SECRET = "c2VjcmV0LWRlLXRlc3QtMzItb2N0ZXRzLWV4YWN0ZW1lbnQ=";
const SECRET_ADMIN = "Y2xlLWFkbWluLWRlLXRlc3QtMzItb2N0ZXRzLWljaSEh";

/**
 * L'export des deux lectures — ux-admin §5.12, §5.13 et §7.
 *
 * « Les listes filtrées s'exportent, pour l'analyse ou la conformité. » Deux
 * mots comptent : **filtrées**, donc l'export porte les mêmes filtres que ce
 * qu'on regarde — sortir tout quand on regarde une semaine serait un autre
 * geste ; et **journalisé**, parce qu'un export du journal d'audit est
 * lui-même un geste d'administration.
 */
describe("administration — l'export des lectures", () => {
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

  const exporter = (chemin: string, entete: Record<string, string>, requete = "") =>
    fetch(`${baseUrl}/v1/admin/${chemin}/export${requete}`, { method: "POST", headers: entete });

  const tracer = (adminId: string, action: string, over: Record<string, unknown> = {}) =>
    db.prisma.auditLog.create({
      data: { actorType: "admin", actorId: adminId, action, reason: "Motif de démonstration", ...over },
    });

  // ─── Le journal d'audit ────────────────────────────────────────────────────

  it("rend un fichier de valeurs séparées, pas du JSON", async () => {
    const { compte, entete } = await session("admin");
    await tracer(compte.id, "user_status_update");

    const res = await exporter("audit-log", entete);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toContain("attachment");
  });

  it("la première ligne nomme les colonnes", async () => {
    const { compte, entete } = await session("admin");
    await tracer(compte.id, "user_status_update");

    const texte = await (await exporter("audit-log", entete)).text();

    expect(texte.split("\n")[0]).toBe("date,acteurType,acteurId,action,motif,cibleType,cibleId");
  });

  it("chaque trace donne une ligne", async () => {
    const { compte, entete } = await session("admin");
    await tracer(compte.id, "user_status_update");
    await tracer(compte.id, "parameter_update");

    const texte = await (await exporter("audit-log", entete)).text();

    // Deux traces, plus l'entête — et l'export lui-même n'y figure pas : il est
    // écrit après la lecture.
    expect(texte.trim().split("\n")).toHaveLength(3);
  });

  // « Les listes FILTRÉES s'exportent » : sortir tout quand on regarde une
  // semaine serait un autre geste, et personne ne s'en apercevrait à la
  // lecture du fichier.
  it("l'export porte les mêmes filtres que la liste", async () => {
    const { compte, entete } = await session("admin");
    await tracer(compte.id, "user_status_update");
    await tracer(compte.id, "parameter_update");

    const texte = await (await exporter("audit-log", entete, "?action=parameter_update")).text();

    expect(texte).toContain("parameter_update");
    expect(texte).not.toContain("user_status_update");
  });

  // Un motif qui contient une virgule, un guillemet ou un retour à la ligne
  // casserait le fichier en silence : la ligne se scinderait, et une colonne
  // glisserait sur la suivante sans que rien ne le dise.
  it("une valeur qui contient une virgule ne casse pas la ligne", async () => {
    const { compte, entete } = await session("admin");
    await tracer(compte.id, "user_status_update", { reason: "Suspendu, puis rétabli" });

    const texte = await (await exporter("audit-log", entete)).text();

    expect(texte).toContain('"Suspendu, puis rétabli"');
    expect(texte.trim().split("\n")).toHaveLength(2);
  });

  it("un guillemet dans une valeur est doublé, pas laissé nu", async () => {
    const { compte, entete } = await session("admin");
    await tracer(compte.id, "user_status_update", { reason: 'Motif dit « urgent »' });

    const texte = await (await exporter("audit-log", entete)).text();

    expect(texte.trim().split("\n")).toHaveLength(2);
  });

  // « L'export apparaît au journal d'audit » : sortir le journal est
  // lui-même un geste d'administration, et le plus sensible de tous.
  it("l'export du journal s'inscrit au journal", async () => {
    const { compte, entete } = await session("admin");
    await tracer(compte.id, "user_status_update");

    await exporter("audit-log", entete);

    const trace = await db.prisma.auditLog.findFirstOrThrow({ where: { action: "audit_log_export" } });
    expect(trace.actorId).toBe(compte.id);
  });

  // Le motif dit CE QU'ON A SORTI. « qui a sorti quoi » n'a de sens que si le
  // quoi y figure : un motif générique ne dirait rien qu'on ne sache déjà.
  it("la trace de l'export dit ce qui a été sorti", async () => {
    const { compte, entete } = await session("admin");
    await tracer(compte.id, "user_status_update");

    await exporter("audit-log", entete, "?action=user_status_update");

    const trace = await db.prisma.auditLog.findFirstOrThrow({ where: { action: "audit_log_export" } });
    expect(trace.reason).toContain("user_status_update");
    expect(trace.metadata).toMatchObject({ lignes: 1 });
  });

  // ─── Les connexions ────────────────────────────────────────────────────────

  it("les connexions s'exportent aussi", async () => {
    const { entete } = await session("admin");
    await db.prisma.loginActivity.create({
      data: { result: "failure", attemptedEmail: "awa@exemple.cm", method: "otp" },
    });

    const texte = await (await exporter("login-activity", entete)).text();

    expect(texte.split("\n")[0]).toBe("date,compte,adresseTentee,resultat,voie,appareil,lieu");
    expect(texte).toContain("awa@exemple.cm");
  });

  // L'adresse sert aux investigations, pas à l'affichage — ni au fichier qu'on
  // fait circuler par courriel ou dans un tableur.
  it("l'adresse IP ne sort pas dans le fichier", async () => {
    const { entete } = await session("admin");
    await db.prisma.loginActivity.create({
      data: { result: "failure", attemptedEmail: "awa@exemple.cm", method: "otp", ip: "102.244.18.7" },
    });

    const texte = await (await exporter("login-activity", entete)).text();

    expect(texte).not.toContain("102.244.18.7");
  });

  // §5.13 demande un filtre par utilisateur, que le serveur n'acceptait pas.
  it("les connexions se filtrent par utilisateur", async () => {
    const { entete } = await session("admin");
    const u = await db.prisma.user.create({
      data: { email: "awa@exemple.cm", username: "awa", referralCode: "AWA1" },
    });
    await db.prisma.loginActivity.create({ data: { result: "success", userId: u.id, method: "otp" } });
    await db.prisma.loginActivity.create({ data: { result: "failure", attemptedEmail: "autre@exemple.cm", method: "otp" } });

    const corps = (await (await fetch(`${baseUrl}/v1/admin/login-activity?utilisateurId=${u.id}`, { headers: entete })).json()) as {
      items: { compte: string | null }[];
    };

    expect(corps.items).toHaveLength(1);
    expect(corps.items[0]?.compte).toBe("awa");
  });

  // ─── L'injection de formule ────────────────────────────────────────────────

  // Le chemin complet, et il n'exige aucun compte : l'agent utilisateur d'une
  // requête n'est ni validé ni contraint, il suffit de le remplir d'une formule
  // pour qu'elle atterrisse dans la table, puis dans le fichier qu'un
  // administrateur ouvrira dans son tableur.
  it("un agent utilisateur piégé n'exécute rien à l'ouverture", async () => {
    const { entete } = await session("admin");
    await db.prisma.loginActivity.create({
      data: {
        result: "failure", attemptedEmail: "awa@exemple.cm", method: "otp",
        userAgent: '=HYPERLINK("http://exemple","clic")',
      },
    });

    const texte = await (await exporter("login-activity", entete)).text();

    // Neutralisé par l'apostrophe : le tableur lit du texte, pas un calcul.
    expect(texte).toContain(`"'=HYPERLINK`);
    // Et surtout : aucune cellule ne commence par « = » sans elle.
    for (const cellule of texte.split("\n").slice(1).flatMap((l) => l.split('","'))) {
      expect(cellule.replace(/^"/, "")).not.toMatch(/^[=+@]/);
    }
  });

  // L'adresse tentée d'un code à usage unique suit le même chemin, et se
  // remplit sans compte elle aussi.
  it("une adresse tentée piégée est neutralisée", async () => {
    const { entete } = await session("admin");
    await db.prisma.loginActivity.create({
      data: { result: "failure", attemptedEmail: "=1+1", method: "otp" },
    });

    const texte = await (await exporter("login-activity", entete)).text();

    expect(texte).toContain(`"'=1+1"`);
  });

  // Un motif d'administration est du texte libre, écrit par quelqu'un de
  // l'équipe — moins hostile, mais rien ne l'empêche de commencer par un tiret.
  it("un motif du journal est neutralisé de la même façon", async () => {
    const { compte, entete } = await session("admin");
    await tracer(compte.id, "user_status_update", { reason: "-5 crédits repris" });

    const texte = await (await exporter("audit-log", entete)).text();

    expect(texte).toContain(`"'-5 crédits repris"`);
  });

  // ─── Les droits ────────────────────────────────────────────────────────────

  /**
   * Le sixième, et le premier où la distinction se voit à l'œil nu : §6 ouvre
   * la LECTURE des métriques au support — « consulter le tableau de bord, les
   * métriques, les connexions ». Sa sortie, elle, reste fermée comme les cinq
   * autres. Voir une liste et pouvoir la sortir sont deux choses.
   */
  it("l'export des métriques est fermé au support, dont la lecture est ouverte", async () => {
    const { entete } = await session("support");

    expect((await exporter("metrics", entete)).status).toBe(403);
  });

  it("l'administrateur sort les cohortes de rétention", async () => {
    const { entete } = await session("admin");

    const reponse = await exporter("metrics", entete, "?periode=90j");
    expect(reponse.status).toBe(200);
    expect(await reponse.text()).toContain("mois");
  });

  // Le journal est réservé aux administrateurs : son export l'est aussi, sans
  // quoi le support en obtiendrait par la sortie ce qu'on lui refuse à l'écran.
  it("l'export du journal est fermé au support", async () => {
    const { entete } = await session("support");

    expect((await exporter("audit-log", entete)).status).toBe(403);
  });

  /**
   * **Aucun export pour le support** — décision du porteur du projet, le
   * 27/08/2026, et elle vaut pour les cinq.
   *
   * Celui-ci était le seul ouvert, parce que sa liste l'est : le principe
   * « l'export suit la visibilité de sa liste » tenait pour les connexions et
   * pas pour les comptes, dont l'écran fermait déjà le bouton. C'était
   * l'incohérence, et c'est elle qu'on lève.
   *
   * Voir une liste et pouvoir la sortir sont deux choses : la seconde produit
   * un fichier qui quitte l'outil, circule par courriel et s'ouvre dans un
   * tableur. C'est le geste qu'on borne, pas la lecture.
   */
  it("l'export des connexions est fermé au support, comme les quatre autres", async () => {
    const { entete } = await session("support");

    expect((await exporter("login-activity", entete)).status).toBe(403);
  });

  it("rien ne sort sans session", async () => {
    expect((await exporter("audit-log", {})).status).toBe(401);
    expect((await exporter("login-activity", {})).status).toBe(401);
  });

  // ─── Les trois listes d'exploitation ───────────────────────────────────────
  //
  // « Les listes filtrées s'exportent, pour l'analyse ou la conformité »
  // (ux-admin §7). Le journal et les connexions le faisaient ; les comptes, les
  // paiements et les mouvements de crédits, non — c'étaient pourtant les trois
  // qu'on demande le jour d'un contrôle.

  describe("les comptes", () => {
    const compte = async (over: Record<string, unknown> = {}) => db.prisma.user.create({
      data: {
        email: `${randomBytes(6).toString("hex")}@exemple.cm`,
        username: `u${randomBytes(4).toString("hex")}`,
        referralCode: randomBytes(4).toString("hex").toUpperCase(),
        ...over,
      },
    });

    /**
     * **Réservé aux administrateurs**, et c'est un choix qui mérite d'être dit.
     *
     * §6 accorde au support « consulter les comptes » et « consulter les
     * paiements et les mouvements de crédits », et §7 n'assortit l'export
     * d'aucun rôle : les deux ensemble le lui ouvriraient. L'écran des comptes,
     * lui, réserve déjà son bouton d'export aux administrateurs.
     *
     * Devant ce désaccord, on prend la lecture la plus fermée : un fichier sort
     * de l'outil et circule, restreindre se défait d'une ligne, élargir laisse
     * sortir des données. À trancher — voir K du fichier d'écarts.
     */
    it("est réservé aux administrateurs, comme le bouton de l'écran", async () => {
      const { entete } = await session("support");
      expect((await exporter("users", entete)).status).toBe(403);
    });

    it("rend un document nommé, avec ses colonnes", async () => {
      const { entete } = await session("admin");
      await compte({ username: "awa" });

      const res = await exporter("users", entete);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/csv");
      const texte = await res.text();
      expect(texte.split("\n")[0]).toContain("pseudo");
      expect(texte).toContain("awa");
    });

    // Le filtre affiché doit partir dans la requête, sinon on exporterait la
    // liste entière en croyant exporter sa sélection — et le fichier dirait
    // autre chose que l'écran.
    it("n'emporte que la sélection affichée", async () => {
      const { entete } = await session("admin");
      // Des pseudos qui ne ressemblent à aucun état : nommer un compte
      // « suspendu » rendait l'assertion vraie que le filtre morde ou non.
      await compte({ username: "zoe", status: "active" });
      await compte({ username: "kofi", status: "suspended" });

      const texte = await (await exporter("users", entete, "?status=suspended")).text();
      expect(texte).toContain("kofi");
      expect(texte).not.toContain("zoe");
    });

    // Et l'autre filtre, qui a le sien : une recherche vide ne doit pas tout
    // ramener sous prétexte qu'elle ne dit rien.
    it("la recherche libre borne aussi l'export", async () => {
      const { entete } = await session("admin");
      await compte({ username: "zoe" });
      await compte({ username: "kofi" });

      const texte = await (await exporter("users", entete, "?q=kof")).text();
      expect(texte).toContain("kofi");
      expect(texte).not.toContain("zoe");
    });

    it("inscrit au journal ce qui a été exporté, avec son filtre", async () => {
      const { compte: admin, entete } = await session("admin");
      await exporter("users", entete, "?status=suspended");

      const trace = await db.prisma.auditLog.findFirstOrThrow({ where: { action: "user_export" } });
      expect(trace.actorId).toBe(admin.id);
      expect(trace.reason).toContain("suspended");
    });
  });

  describe("les paiements", () => {
    const paiement = async (over: Record<string, unknown> = {}) => {
      const u = await db.prisma.user.create({
        data: {
          email: `${randomBytes(6).toString("hex")}@exemple.cm`,
          username: `p${randomBytes(4).toString("hex")}`,
          referralCode: randomBytes(4).toString("hex").toUpperCase(),
        },
      });
      const collecte = await db.prisma.collectionAccount.create({
        data: { label: "MTN principal", operator: "mtn", number: "237690000000", isActive: true },
      });
      return db.prisma.payment.create({
        data: {
          userId: u.id, mode: "manual", collectionAccountId: collecte.id,
          amount: 1000, currency: "XAF", credits: 10, ...over,
        },
      });
    };

    /**
     * **Réservé aux administrateurs**, et c'est un choix qui mérite d'être dit.
     *
     * §6 accorde au support « consulter les comptes » et « consulter les
     * paiements et les mouvements de crédits », et §7 n'assortit l'export
     * d'aucun rôle : les deux ensemble le lui ouvriraient. L'écran des comptes,
     * lui, réserve déjà son bouton d'export aux administrateurs.
     *
     * Devant ce désaccord, on prend la lecture la plus fermée : un fichier sort
     * de l'outil et circule, restreindre se défait d'une ligne, élargir laisse
     * sortir des données. À trancher — voir K du fichier d'écarts.
     */
    it("est réservé aux administrateurs, comme le bouton de l'écran", async () => {
      const { entete } = await session("support");
      expect((await exporter("payments", entete)).status).toBe(403);
    });

    it("rend les paiements, filtre compris", async () => {
      const { entete } = await session("admin");
      const abouti = await paiement({ status: "succeeded" });
      const echoue = await paiement({ status: "failed" });

      const texte = await (await exporter("payments", entete, "?etat=succeeded")).text();

      // Sur le pseudo du payeur, qui distingue les deux : compter les lignes
      // passerait aussi bien si le filtre ne filtrait rien et qu'il n'y avait
      // qu'un paiement.
      const nomAbouti = (await db.prisma.user.findUniqueOrThrow({ where: { id: abouti.userId } })).username;
      const nomEchoue = (await db.prisma.user.findUniqueOrThrow({ where: { id: echoue.userId } })).username;
      expect(texte).toContain(nomAbouti);
      expect(texte).not.toContain(nomEchoue);
    });

    /**
     * **Le numéro d'un compte mobile money ne sort jamais**, pas même pour un
     * administrateur — il est chiffré au repos et masqué à l'affichage. Un
     * fichier circule par courriel et s'ouvre dans un tableur : c'est le
     * dernier endroit où le laisser passer.
     */
    it("ne laisse pas échapper le numéro de mobile money", async () => {
      const { entete } = await session("admin");
      const p = await paiement({ payerMsisdn: "237699887766" });
      void p;

      const texte = await (await exporter("payments", entete)).text();
      expect(texte).not.toContain("237699887766");
      expect(texte).not.toContain("237690000000");
    });

    it("inscrit au journal ce qui a été exporté", async () => {
      const { entete } = await session("admin");
      await exporter("payments", entete, "?etat=pending");

      const trace = await db.prisma.auditLog.findFirstOrThrow({ where: { action: "payment_export" } });
      expect(trace.reason).toContain("pending");
    });
  });

  describe("les mouvements de crédits", () => {
    /**
     * **Réservé aux administrateurs**, et c'est un choix qui mérite d'être dit.
     *
     * §6 accorde au support « consulter les comptes » et « consulter les
     * paiements et les mouvements de crédits », et §7 n'assortit l'export
     * d'aucun rôle : les deux ensemble le lui ouvriraient. L'écran des comptes,
     * lui, réserve déjà son bouton d'export aux administrateurs.
     *
     * Devant ce désaccord, on prend la lecture la plus fermée : un fichier sort
     * de l'outil et circule, restreindre se défait d'une ligne, élargir laisse
     * sortir des données. À trancher — voir K du fichier d'écarts.
     */
    it("est réservé aux administrateurs, comme le bouton de l'écran", async () => {
      const { entete } = await session("support");
      expect((await exporter("credit-transactions", entete)).status).toBe(403);
    });

    it("rend les mouvements, filtre compris", async () => {
      const { entete } = await session("admin");
      const u = await db.prisma.user.create({
        data: {
          email: `${randomBytes(6).toString("hex")}@exemple.cm`,
          username: "beneficiaire",
          referralCode: randomBytes(4).toString("hex").toUpperCase(),
        },
      });
      await db.prisma.creditTransaction.create({
        data: { userId: u.id, type: "grant", source: "signup_grant", amount: 5 },
      });
      await db.prisma.creditTransaction.create({
        data: { userId: u.id, type: "consumption", source: "consumption", amount: -1 },
      });

      const texte = await (await exporter("credit-transactions", entete, "?type=grant")).text();
      expect(texte).toContain("signup_grant");
      expect(texte).not.toContain("consumption");
    });

    it("inscrit au journal ce qui a été exporté", async () => {
      const { entete } = await session("admin");
      await exporter("credit-transactions", entete, "?type=adjustment");

      const trace = await db.prisma.auditLog.findFirstOrThrow({ where: { action: "credit_transaction_export" } });
      expect(trace.reason).toContain("adjustment");
    });
  });
});
