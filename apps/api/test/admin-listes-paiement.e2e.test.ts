import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { withDatabase, resetDatabase, avecMotif, type TestDb } from "./db.js";
import { AppModule } from "../src/app.module.js";
import { AppExceptionFilter } from "../src/common/errors.js";
import { AdminTokenService } from "../src/admin/admin-token.service.js";
import { pagePaiementsSchema, pageMouvementsSchema, paiementDetailSchema } from "@lehno/contracts";

const PEPPER = "dGVzdC1wZXBwZXItMzItb2N0ZXRzLWV4YWN0ZW1lbnQhIQ==";
const SECRET = "c2VjcmV0LWRlLXRlc3QtMzItb2N0ZXRzLWV4YWN0ZW1lbnQ=";
const SECRET_ADMIN = "Y2xlLWFkbWluLWRlLXRlc3QtMzItb2N0ZXRzLWljaSEh";

describe("administration — les deux listes du paiement", () => {
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

  const lire = (chemin: string, entete: Record<string, string>) =>
    fetch(`${baseUrl}/v1/admin/${chemin}`, { headers: entete });

  const decor = async () => {
    const [utilisateur, palier, compte, canal] = await Promise.all([
      db.prisma.user.create({ data: { email: "awa@exemple.cm", username: "awa", referralCode: "AWA1" } }),
      db.prisma.creditBundle.findFirstOrThrow({ where: { position: 2 } }),
      db.prisma.collectionAccount.create({
        data: { label: "Orange Money principal", operator: "orange_money", number: "690000000" },
      }),
      avecMotif(db.prisma, "fixture de test", (tx) => tx.paymentChannel.create({
        data: { kind: "mobile_money", operator: "orange_money", country: "CM", label: "Orange Money", feePercent: 2 },
      })),
    ]);
    return { utilisateur, palier, compte, canal };
  };

  const saisir = async (entete: Record<string, string>, d: Awaited<ReturnType<typeof decor>>) => {
    const res = await fetch(`${baseUrl}/v1/admin/payments`, {
      method: "POST",
      headers: { ...entete, "content-type": "application/json" },
      body: JSON.stringify({
        utilisateurId: d.utilisateur.id, palierId: d.palier.id,
        compteCollecteId: d.compte.id, canalId: d.canal.id,
        reason: "Versement constaté sur le compte Orange",
      }),
    });
    return ((await res.json()) as { id: string }).id;
  };

  const confirmer = (entete: Record<string, string>, id: string, montantRecu = 1000) =>
    fetch(`${baseUrl}/v1/admin/payments/${id}/decision`, {
      method: "POST",
      headers: { ...entete, "content-type": "application/json" },
      body: JSON.stringify({
        decision: "confirmer", montantRecu,
        reference: `MP${Math.floor(montantRecu)}`, reason: "Réception constatée sur le compte",
        reasonCode: "operation_seen_at_the_operator",
      }),
    });

  // ─── La liste des paiements ────────────────────────────────────────────────

  it("la liste suit le contrat publié, au champ près", async () => {
    const { entete } = await session("admin");
    await saisir(entete, await decor());

    const corps = await (await lire("payments", entete)).json();

    const valide = pagePaiementsSchema.safeParse(corps);
    expect(valide.success ? null : valide.error.issues).toBeNull();
  });

  it("pagine par curseur, sans total", async () => {
    const { entete } = await session("admin");
    const d = await decor();
    await saisir(entete, d);
    await saisir(entete, d);
    await saisir(entete, d);

    const p1 = (await (await lire("payments?limit=2", entete)).json()) as {
      items: { id: string }[]; nextCursor: string | null;
    };

    expect(p1.items).toHaveLength(2);
    expect(p1.nextCursor).not.toBeNull();
    expect(Object.keys(p1)).toEqual(["items", "nextCursor"]);
  });

  it("le curseur ramène la suite, sans répéter ni sauter", async () => {
    const { entete } = await session("admin");
    const d = await decor();
    for (let i = 0; i < 3; i += 1) await saisir(entete, d);

    const p1 = (await (await lire("payments?limit=2", entete)).json()) as {
      items: { id: string }[]; nextCursor: string;
    };
    const p2 = (await (await lire(`payments?limit=2&cursor=${p1.nextCursor}`, entete)).json()) as {
      items: { id: string }[];
    };

    const vus = [...p1.items, ...p2.items].map((p) => p.id);
    expect(new Set(vus).size).toBe(3);
  });

  it("filtre par état", async () => {
    const { entete } = await session("admin");
    const d = await decor();
    const a = await saisir(entete, d);
    await saisir(entete, d);
    await confirmer(entete, a);

    const corps = (await (await lire("payments?etat=succeeded", entete)).json()) as {
      items: { id: string }[];
    };

    expect(corps.items.map((p) => p.id)).toEqual([a]);
  });

  it("filtre par utilisateur", async () => {
    const { entete } = await session("admin");
    const d = await decor();
    await saisir(entete, d);
    const autre = await db.prisma.user.create({
      data: { email: "karim@exemple.cm", username: "karim", referralCode: "KAR1" },
    });

    const corps = (await (await lire(`payments?utilisateurId=${autre.id}`, entete)).json()) as {
      items: unknown[];
    };

    expect(corps.items).toHaveLength(0);
  });

  // L'écart est ce qu'on vient regarder : il se lit sur la liste, pas seulement
  // dans le détail.
  it("l'écart se lit sur la liste", async () => {
    const { entete } = await session("admin");
    const id = await saisir(entete, await decor());
    await confirmer(entete, id, 900);

    const corps = (await (await lire("payments", entete)).json()) as {
      items: { ecart: number | null }[];
    };

    expect(corps.items[0]?.ecart).toBe(-100);
  });

  it("un paiement que personne n'a constaté n'a pas d'écart", async () => {
    const { entete } = await session("admin");
    await saisir(entete, await decor());

    const corps = (await (await lire("payments", entete)).json()) as {
      items: { ecart: number | null }[];
    };

    expect(corps.items[0]?.ecart).toBeNull();
  });

  // « L'outil affiche une méthode de paiement par ses seuls éléments
  // d'identification. Le numéro complet d'un compte mobile money demeure
  // masqué, y compris pour l'administrateur. »
  it("la méthode ne paraît que par ses derniers chiffres", async () => {
    const { entete } = await session("admin");
    const d = await decor();
    const methode = await db.prisma.paymentMethod.create({
      data: {
        userId: d.utilisateur.id, kind: "mobile_money",
        msisdn: "chiffré:237690001234", brand: "MTN MoMo", last4: "1234",
      },
    });
    const id = await saisir(entete, d);
    await db.prisma.payment.update({ where: { id }, data: { paymentMethodId: methode.id } });

    const corps = (await (await lire("payments", entete)).json()) as {
      items: { methode: string | null }[];
    };

    expect(corps.items[0]?.methode).toBe("MTN MoMo ••••1234");
    expect(JSON.stringify(corps)).not.toContain("237690001234");
  });

  // ─── Le détail, et les durées ──────────────────────────────────────────────

  it("le détail suit le contrat publié", async () => {
    const { entete } = await session("admin");
    const id = await saisir(entete, await decor());
    await confirmer(entete, id);

    const corps = await (await lire(`payments/${id}`, entete)).json();

    const valide = paiementDetailSchema.safeParse(corps);
    expect(valide.success ? null : valide.error.issues).toBeNull();
  });

  // « L'historique de ses états — chacun avec sa durée, ce qui l'a provoqué et
  // son auteur. » La durée est ce qu'on vient chercher : combien de temps ce
  // paiement est resté en attente.
  it("l'histoire porte la durée de chaque état traversé", async () => {
    const { compte, entete } = await session("admin");
    const id = await saisir(entete, await decor());
    await confirmer(entete, id);

    const corps = (await (await lire(`payments/${id}`, entete)).json()) as {
      histoire: { etat: string; dureeSecondes: number | null; origine: string; parQui: string | null }[];
    };

    expect(corps.histoire.map((h) => h.etat)).toEqual(["pending", "succeeded"]);
    // Le premier est clos : sa durée se lit.
    expect(corps.histoire[0]?.dureeSecondes).not.toBeNull();
    // Le courant dure encore : pas de durée à annoncer.
    expect(corps.histoire[1]?.dureeSecondes).toBeNull();
    expect(corps.histoire[1]?.origine).toBe("admin");
    expect(corps.histoire[1]?.parQui).toBe(compte.email);
  });

  it("un paiement inconnu rend 404", async () => {
    const { entete } = await session("admin");

    expect((await lire("payments/00000000-0000-0000-0000-000000000000", entete)).status).toBe(404);
  });

  // ─── Les mouvements de crédits ─────────────────────────────────────────────

  it("les mouvements suivent le contrat publié", async () => {
    const { entete } = await session("admin");
    const id = await saisir(entete, await decor());
    await confirmer(entete, id);

    const corps = await (await lire("credit-transactions", entete)).json();

    const valide = pageMouvementsSchema.safeParse(corps);
    expect(valide.success ? null : valide.error.issues).toBeNull();
  });

  it("un octroi d'achat porte son paiement", async () => {
    const { entete } = await session("admin");
    const id = await saisir(entete, await decor());
    await confirmer(entete, id);

    const corps = (await (await lire("credit-transactions", entete)).json()) as {
      items: { paiementId: string | null; source: string; montant: number }[];
    };

    expect(corps.items[0]).toMatchObject({ paiementId: id, source: "purchase", montant: 10 });
  });

  it("les mouvements se filtrent par utilisateur", async () => {
    const { entete } = await session("admin");
    const d = await decor();
    const id = await saisir(entete, d);
    await confirmer(entete, id);

    const corps = (await (await lire(`credit-transactions?utilisateurId=${d.utilisateur.id}`, entete)).json()) as {
      items: unknown[];
    };

    expect(corps.items).toHaveLength(1);
  });

  // ─── Les droits ────────────────────────────────────────────────────────────

  // « Consulter les paiements et les mouvements de crédits » appartient au
  // support (ux-admin §6) : c'est ce dont il a besoin pour répondre à quelqu'un
  // qui demande où en est son achat.
  it("le support lit les deux listes", async () => {
    const { entete } = await session("support");

    expect((await lire("payments", entete)).status).toBe(200);
    expect((await lire("credit-transactions", entete)).status).toBe(200);
  });

  it("rien n'est ouvert sans session", async () => {
    expect((await lire("payments", {})).status).toBe(401);
    expect((await lire("credit-transactions", {})).status).toBe(401);
  });
});
