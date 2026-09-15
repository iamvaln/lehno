import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { AppModule } from "../src/app.module.js";
import { AppExceptionFilter } from "../src/common/errors.js";
import { AdminTokenService } from "../src/admin/admin-token.service.js";
import { paliersSchema, canauxSchema, comptesCollecteSchema } from "@lehno/contracts";

const PEPPER = "dGVzdC1wZXBwZXItMzItb2N0ZXRzLWV4YWN0ZW1lbnQhIQ==";
const SECRET = "c2VjcmV0LWRlLXRlc3QtMzItb2N0ZXRzLWV4YWN0ZW1lbnQ=";
const SECRET_ADMIN = "Y2xlLWFkbWluLWRlLXRlc3QtMzItb2N0ZXRzLWljaSEh";

describe("administration — les réglages du paiement", () => {
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

  beforeEach(async () => {
    await resetDatabase(db.prisma);
    // `credit_bundle` est une table de référence : la migration la sème et
    // resetDatabase la préserve. On remet donc les valeurs semées plutôt que de
    // les créer — un test qui a modifié un palier ne doit pas décider du point
    // de départ du suivant.
    await db.prisma.creditBundle.updateMany({ where: { position: 1 }, data: { credits: 5, amount: 500 } });
  });
  afterAll(async () => { await app?.close(); await db.close(); });

  const session = async (role: "support" | "admin") => {
    const compte = await db.prisma.admin.create({ data: { email: `${role}@lehno.app`, role } });
    const { accessToken } = await jetons.ouvrir(compte.id);
    return { compte, entete: { authorization: `Bearer ${accessToken}` } };
  };

  const appeler = (chemin: string, entete: Record<string, string>, methode = "GET", corps?: unknown) =>
    fetch(`${baseUrl}/v1/admin/${chemin}`, {
      method: methode,
      headers: corps === undefined ? entete : { ...entete, "content-type": "application/json" },
      ...(corps === undefined ? {} : { body: JSON.stringify(corps) }),
    });

  const CANAL = {
    nature: "mobile_money", operateur: "mtn_momo", pays: "CM", libelle: "MTN Mobile Money",
    fraisPourcent: 2, fraisFixe: 0, fraisPortesPar: "payer",
    reason: "Ouverture du canal MTN au Cameroun",
  };

  // ─── Les paliers ───────────────────────────────────────────────────────────

  it("les paliers suivent le contrat publié, au champ près", async () => {
    const { entete } = await session("admin");

    const corps = await (await appeler("credit-bundles", entete)).json();

    const valide = paliersSchema.safeParse(corps);
    expect(valide.success ? null : valide.error.issues).toBeNull();
  });

  it("les cinq paliers de départ sont là, dans leur ordre", async () => {
    const { entete } = await session("admin");

    const corps = (await (await appeler("credit-bundles", entete)).json()) as {
      items: { montant: number; credits: number }[];
    };

    expect(corps.items.map((p) => [p.montant, p.credits])).toEqual([
      [500, 5], [1000, 10], [2000, 22], [5000, 57], [10000, 120],
    ]);
  });

  it("modifier un palier exige un motif, et passe au journal", async () => {
    const { compte, entete } = await session("admin");
    const palier = await db.prisma.creditBundle.findFirstOrThrow({ where: { position: 1 } });

    const res = await appeler(`credit-bundles/${palier.id}`, entete, "PATCH", {
      credits: 6, reason: "Promotion de lancement",
    });

    expect(res.status).toBe(200);
    const trace = await db.prisma.auditLog.findFirstOrThrow({ where: { action: "credit_bundle_update" } });
    expect(trace.actorId).toBe(compte.id);
    expect(trace.reason).toBe("Promotion de lancement");
  });

  it("un palier sans motif est refusé, et rien ne bouge", async () => {
    const { entete } = await session("admin");
    const palier = await db.prisma.creditBundle.findFirstOrThrow({ where: { position: 1 } });

    const res = await appeler(`credit-bundles/${palier.id}`, entete, "PATCH", { credits: 99, reason: "court" });

    expect(res.status).toBe(400);
    expect((await db.prisma.creditBundle.findUniqueOrThrow({ where: { id: palier.id } })).credits).toBe(5);
  });

  // ─── Les canaux ────────────────────────────────────────────────────────────

  it("les canaux suivent le contrat publié", async () => {
    const { entete } = await session("admin");
    await appeler("payment-channels", entete, "POST", CANAL);

    const corps = await (await appeler("payment-channels", entete)).json();

    const valide = canauxSchema.safeParse(corps);
    expect(valide.success ? null : valide.error.issues).toBeNull();
  });

  // Deux barèmes concurrents rendraient l'aperçu indéterminé, et personne ne
  // saurait lequel a servi à expliquer un paiement.
  it("un opérateur n'a qu'un barème par pays", async () => {
    const { entete } = await session("admin");
    await appeler("payment-channels", entete, "POST", CANAL);

    const res = await appeler("payment-channels", entete, "POST", CANAL);

    expect(res.status).toBe(409);
  });

  it("le même opérateur a un barème par pays différent", async () => {
    const { entete } = await session("admin");
    await appeler("payment-channels", entete, "POST", CANAL);

    const res = await appeler("payment-channels", entete, "POST", { ...CANAL, pays: "CI" });

    expect(res.status).toBe(201);
  });

  // Un paiement passé le référence, et son barème explique le montant versé ce
  // jour-là. L'effacer rendrait ce paiement inexplicable.
  it("un canal ne se supprime pas, il se désactive", async () => {
    const { entete } = await session("admin");
    const cree = (await (await appeler("payment-channels", entete, "POST", CANAL)).json()) as { id: string };

    const suppression = await appeler(`payment-channels/${cree.id}`, entete, "DELETE");

    expect(suppression.status).toBe(404);
    await appeler(`payment-channels/${cree.id}`, entete, "PATCH", { actif: false, reason: "Barème renégocié" });
    expect((await db.prisma.paymentChannel.findUniqueOrThrow({ where: { id: cree.id } })).isActive).toBe(false);
  });

  it("modifier un barème passe au journal", async () => {
    const { entete } = await session("admin");
    const cree = (await (await appeler("payment-channels", entete, "POST", CANAL)).json()) as { id: string };

    await appeler(`payment-channels/${cree.id}`, entete, "PATCH", {
      fraisPourcent: 2.5, reason: "MTN a relevé son barème",
    });

    const trace = await db.prisma.auditLog.findFirstOrThrow({ where: { action: "payment_channel_update" } });
    expect(trace.reason).toBe("MTN a relevé son barème");
  });

  /* Le journal et l'historique ne disent pas la même chose, et c'est pour ça
     qu'il faut les deux : le premier raconte le changement, le second établit
     l'état. Ce cas éprouve le raccord entre les gestes de l'administration et
     le déclencheur — la raison écrite par l'administrateur doit arriver
     jusqu'à la ligne de version, pas une valeur posée par le harnais. */
  it("la raison de l'administrateur arrive jusqu'à la version", async () => {
    const { entete } = await session("admin");
    const cree = (await (await appeler("payment-channels", entete, "POST", CANAL)).json()) as { id: string };

    await appeler(`payment-channels/${cree.id}`, entete, "PATCH", {
      fraisPourcent: 2.5, reason: "MTN a relevé son barème",
    });

    const versions = await db.prisma.paymentChannelHistory.findMany({
      where: { paymentChannelId: cree.id }, orderBy: { validFrom: "asc" },
    });
    expect(versions).toHaveLength(2);
    expect(versions[0]!.reason).toBe(CANAL.reason);
    expect(versions[0]!.validTo).not.toBeNull();
    expect(versions[1]!.reason).toBe("MTN a relevé son barème");
    expect(versions[1]!.validTo).toBeNull();
    // L'auteur aussi : un historique sans auteur ne règle aucun différend.
    expect(versions[1]!.changedBy).not.toBeNull();
  });

  // ─── Les comptes de collecte ───────────────────────────────────────────────

  const COMPTE = {
    libelle: "Orange Money principal", operateur: "orange_money", numero: "690000000",
    reason: "Ouverture du compte de collecte principal",
  };

  it("les comptes de collecte suivent le contrat publié", async () => {
    const { entete } = await session("admin");
    await appeler("collection-accounts", entete, "POST", COMPTE);

    const corps = await (await appeler("collection-accounts", entete)).json();

    const valide = comptesCollecteSchema.safeParse(corps);
    expect(valide.success ? null : valide.error.issues).toBeNull();
  });

  // Le numéro se dicte à un client au téléphone, et se lit sur l'application de
  // l'opérateur pour vérifier une réception. Ce n'est pas une donnée de client :
  // c'est un compte du service.
  it("le numéro est rendu en entier à l'administration", async () => {
    const { entete } = await session("admin");
    await appeler("collection-accounts", entete, "POST", COMPTE);

    const corps = (await (await appeler("collection-accounts", entete)).json()) as {
      items: { numero: string }[];
    };

    expect(corps.items[0]?.numero).toBe("690000000");
  });

  // Deux choses différentes : le premier décide de ce que le client voit, le
  // second de ce qui reste employable. Un compte peut servir à l'administration
  // sans paraître aux clients — le temps d'un essai, ou parce qu'il sert
  // d'appoint.
  it("la visibilité et l'activité se règlent séparément", async () => {
    const { entete } = await session("admin");
    const cree = (await (await appeler("collection-accounts", entete, "POST", COMPTE)).json()) as { id: string };

    await appeler(`collection-accounts/${cree.id}`, entete, "PATCH", {
      visibleDansApp: true, reason: "Ouverture aux clients",
    });

    const ligne = await db.prisma.collectionAccount.findUniqueOrThrow({ where: { id: cree.id } });
    expect(ligne.isVisibleInApp).toBe(true);
    expect(ligne.isActive).toBe(true);
  });

  it("un compte neuf n'est pas visible tant qu'on ne l'a pas décidé", async () => {
    const { entete } = await session("admin");

    const cree = (await (await appeler("collection-accounts", entete, "POST", COMPTE)).json()) as { id: string };

    expect((await db.prisma.collectionAccount.findUniqueOrThrow({ where: { id: cree.id } })).isVisibleInApp).toBe(false);
  });

  // ─── Les droits ────────────────────────────────────────────────────────────

  // « Le rôle support n'a accès à aucune section de la famille Économie, y
  // compris en lecture » (ux-admin §6). Les réglages du paiement en font partie.
  it("tout est fermé au support", async () => {
    const { entete } = await session("support");

    for (const chemin of ["credit-bundles", "payment-channels", "collection-accounts"]) {
      expect((await appeler(chemin, entete)).status, chemin).toBe(403);
    }
  });

  it("rien n'est ouvert sans session", async () => {
    for (const chemin of ["credit-bundles", "payment-channels", "collection-accounts"]) {
      expect((await appeler(chemin, {})).status, chemin).toBe(401);
    }
  });

  /* LE PRIX D'UNE ACTION PAYANTE SE RÈGLE ENFIN.
   *
   * Il vivait en base sans aucun moyen de l'y changer. Le registre du contrat
   * affirme pourtant « le prix se règle en administration sans livraison » —
   * c'était faux : ni route ni écran. Le seul moyen de passer un portrait à
   * deux crédits était une requête SQL sur la production.
   *
   * Ce n'est pas un confort : le prix décide de la marge, et la marge d'une
   * génération dépend de tarifs de modèles qui bougent sans prévenir. */
  describe("les actions payantes", () => {
    const ACTIONS = ["gift_ideas", "portrait", "wish_message"] as const;

    const semer = async (): Promise<void> => {
      await db.prisma.premiumAction.createMany({
        data: [
          { code: "gift_ideas", label: "Des idées de cadeaux", creditCost: 1 },
          { code: "portrait", label: "Un portrait", creditCost: 1 },
          { code: "wish_message", label: "Un message", creditCost: 1 },
        ],
        skipDuplicates: true,
      });
    };

    it("liste les trois actions et leur prix", async () => {
      await semer();
      const { entete } = await session("admin");
      const r = await appeler("premium-actions", entete);
      expect(r.status).toBe(200);
      const corps = (await r.json()) as { items: { code: string; cout: number }[] };
      expect(corps.items.map((a) => a.code).sort()).toEqual([...ACTIONS]);
      expect(corps.items.every((a) => a.cout === 1)).toBe(true);
    });

    it("change le prix, et le changement se relit", async () => {
      await semer();
      const { entete } = await session("admin");
      const r = await appeler("premium-actions/portrait", entete, "PATCH", {
        cout: 2, reason: "Le portrait consomme un brief ET une image",
      });
      expect(r.status).toBe(200);

      const apres = await db.prisma.premiumAction.findUnique({ where: { code: "portrait" } });
      expect(apres?.creditCost).toBe(2);
      /* Et les autres n'ont pas bougé : le geste porte sur UNE action. */
      const autre = await db.prisma.premiumAction.findUnique({ where: { code: "wish_message" } });
      expect(autre?.creditCost).toBe(1);
    });

    /* LE MOTIF EST OBLIGATOIRE, comme pour tout geste d'administration : un
       prix qui change sans raison consignée est un prix que personne ne peut
       expliquer trois mois plus tard. */
    it("refuse un changement sans motif", async () => {
      await semer();
      const { entete } = await session("admin");
      const r = await appeler("premium-actions/portrait", entete, "PATCH", { cout: 2 });
      expect(r.status).toBe(400);
      expect((await db.prisma.premiumAction.findUnique({ where: { code: "portrait" } }))?.creditCost).toBe(1);
    });

    /* ET UN CORPS QUI NE DEMANDE RIEN EST REFUSÉ. Sans ce refus, un appel vide
       mais bien formé consignerait un motif au journal sans rien changer — une
       ligne d'audit qui ment sur ce qui s'est passé. */
    it("refuse un appel qui ne modifie rien", async () => {
      await semer();
      const { entete } = await session("admin");
      const r = await appeler("premium-actions/portrait", entete, "PATCH", {
        reason: "Je ne change rien du tout",
      });
      expect(r.status).toBe(400);
    });

    it("rend 404 sur une action inconnue", async () => {
      await semer();
      const { entete } = await session("admin");
      const r = await appeler("premium-actions/inexistante", entete, "PATCH", {
        cout: 2, reason: "Action qui n'existe pas",
      });
      expect(r.status).toBe(404);
    });

    /* LE GESTE EST CONSIGNÉ, avec l'avant et l'après. C'est ce qui permet de
       répondre à « pourquoi le portrait est passé à deux crédits le 15 ». */
    it("consigne le geste au journal, avec l'avant et l'après", async () => {
      await semer();
      const { compte, entete } = await session("admin");
      await appeler("premium-actions/portrait", entete, "PATCH", {
        cout: 2, reason: "Le portrait consomme un brief ET une image",
      });

      const ligne = await db.prisma.auditLog.findFirst({
        where: { action: "premium_action_update" }, orderBy: { createdAt: "desc" },
      });
      expect(ligne).not.toBeNull();
      expect(ligne?.actorId).toBe(compte.id);
      expect(ligne?.reason).toBe("Le portrait consomme un brief ET une image");
      /* L'AVANT ET L'APRÈS, tous les deux : un journal qui ne porte que la
         valeur d'arrivée ne dit pas ce qu'on a quitté. */
      const details = JSON.stringify(ligne?.metadata);
      expect(details).toContain("\"cout\":1");
      expect(details).toContain("\"cout\":2");
    });

    /* FERMÉ AU SUPPORT, LECTURE COMPRISE. Toute la famille Économie l'est
       (ux-admin §6) : ce sont les leviers qui engagent le service et ses coûts. */
    it("est fermée au support, y compris en lecture", async () => {
      await semer();
      const { entete } = await session("support");
      expect((await appeler("premium-actions", entete)).status).toBe(403);
      expect((await appeler("premium-actions/portrait", entete, "PATCH", {
        cout: 2, reason: "Tentative depuis le support",
      })).status).toBe(403);
    });
  });
});
