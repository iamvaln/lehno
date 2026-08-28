import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { AppModule } from "../src/app.module.js";
import { AppExceptionFilter } from "../src/common/errors.js";
import { AdminTokenService } from "../src/admin/admin-token.service.js";
import { AmorceStudioService } from "../src/studio/amorce.service.js";
import { StudioConfigurationService } from "../src/studio/configuration.service.js";
import {
  candidatsStudioSchema, etatStudioSchema, historiqueStudioSchema,
  profilsStudioSchema, reglagesDeDepart, type StudioReglages,
} from "@lehno/contracts";

const PEPPER = "dGVzdC1wZXBwZXItMzItb2N0ZXRzLWV4YWN0ZW1lbnQhIQ==";
const SECRET = "c2VjcmV0LWRlLXRlc3QtMzItb2N0ZXRzLWV4YWN0ZW1lbnQ=";
const SECRET_ADMIN = "Y2xlLWFkbWluLWRlLXRlc3QtMzItb2N0ZXRzLWljaSEh";

/** Le code d'erreur de l'enveloppe. `Response.json()` rend `unknown` : le
 *  typer ici une fois évite un `as` à chaque assertion. */
const codeDe = async (res: Response): Promise<string | undefined> =>
  ((await res.json()) as { code?: string }).code;

/* L'administration du Studio : composer, publier, revenir.
 *
 * Le fil de tous ces cas est le même : « on ne garde que ce qu'on a vu
 * tourner ». Chacun garde une porte de service par laquelle cette règle
 * pourrait être contournée sans qu'on ait besoin d'aucune mauvaise intention. */
describe("administration — la configuration du studio", () => {
  let db: TestDb;
  let app: INestApplication;
  let baseUrl: string;
  let jetons: AdminTokenService;
  let amorce: AmorceStudioService;
  let configs: StudioConfigurationService;

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
    amorce = app.get(AmorceStudioService);
    configs = app.get(StudioConfigurationService);
  }, 180_000);

  afterAll(async () => { await app?.close(); await db.close(); });

  beforeEach(async () => {
    await resetDatabase(db.prisma);
    // `resetDatabase` vide `studio_config` : la réconciliation se rejoue,
    // comme au démarrage d'un serveur neuf. Sans elle, chaque cas partirait
    // d'un studio sans configuration en service — un état que la production ne
    // connaît pas, et les cas prouveraient autre chose que ce qu'on croit.
    await amorce.reconcilier();
  });

  const session = async (role: "support" | "admin") => {
    const compte = await db.prisma.admin.create({ data: { email: `${role}@lehno.app`, role } });
    const { accessToken } = await jetons.ouvrir(compte.id);
    return { compte, entete: { authorization: `Bearer ${accessToken}` } };
  };

  const appeler = (methode: string, suffixe: string, entete: Record<string, string>, corps?: unknown) =>
    fetch(`${baseUrl}/v1/admin/portrait-studio${suffixe}`, {
      method: methode,
      headers: { "content-type": "application/json", ...entete },
      ...(corps === undefined ? {} : { body: JSON.stringify(corps) }),
    });

  const reglages = (f: (r: StudioReglages) => void = () => undefined): StudioReglages => {
    const r = JSON.parse(JSON.stringify(reglagesDeDepart())) as StudioReglages;
    f(r);
    return r;
  };

  /** Un brouillon posé directement : ces cas n'éprouvent pas l'appel au modèle. */
  const brouillonner = async (r: StudioReglages) => configs.deposerBrouillon(r);

  const essaiSur = (configId: string, status: "success" | "error" | "timeout" | "refused") =>
    db.prisma.studioTrial.create({
      data: {
        studioConfigId: configId, provider: "anthropic", modelKey: "demande", status,
      },
    });

  const MOTIF = "on essaie une consigne plus courte";

  // ── Le cloisonnement ──────────────────────────────────────────────────────

  /* Le studio est fermé au support Y COMPRIS EN LECTURE : la lecture montre la
     consigne en préparation et le coût des essais. Le décorateur est posé sur
     la CLASSE — sans ce cas, une route ajoutée demain hériterait du droit le
     plus large sans que personne ne le remarque. */
  it("est fermé au support, y compris en lecture", async () => {
    const { entete } = await session("support");
    const brouillon = await brouillonner(reglages());

    for (const [methode, chemin, corps] of [
      ["GET", "/config", undefined],
      ["GET", "/config/history", undefined],
      ["GET", "/candidates", undefined],
      ["GET", "/profiles", undefined],
      ["GET", "/trials", undefined],
      ["PATCH", "/config", { reglages: reglages() }],
      ["POST", "/config/publish", { configId: brouillon.id, note: MOTIF }],
      ["POST", "/config/rollback", { configId: brouillon.id, reason: MOTIF }],
    ] as const) {
      const res = await appeler(methode, chemin, entete, corps);
      expect(res.status, `${methode} ${chemin}`).toBe(403);
      expect(await codeDe(res)).toBe("forbidden");
    }
  });

  // ── Ce que rend la lecture ────────────────────────────────────────────────

  it("suit le contrat publié, au champ près", async () => {
    const { entete } = await session("admin");
    await brouillonner(reglages());

    const etat = etatStudioSchema.parse(await (await appeler("GET", "/config", entete)).json());
    expect(etat.enService?.version).toBe(1);
    expect(etat.enService?.parQui).toBeNull();
    expect(etat.brouillon?.etat).toBe("draft");

    historiqueStudioSchema.parse(await (await appeler("GET", "/config/history", entete)).json());
    profilsStudioSchema.parse(await (await appeler("GET", "/profiles", entete)).json());
    candidatsStudioSchema.parse(await (await appeler("GET", "/candidates", entete)).json());
  });

  /* « Non tarifé » est un état NORMAL à afficher : les prix changent sans nous
     prévenir. Rendre zéro le ferait passer pour un fait, et l'écran afficherait
     un coût d'essai de zéro franc. */
  it("rend un tarif inconnu comme nul, jamais comme zéro", async () => {
    const { entete } = await session("admin");
    await db.prisma.aIModel.create({ data: { provider: "anthropic", modelKey: "sans-tarif" } });

    const candidats = candidatsStudioSchema.parse(await (await appeler("GET", "/candidates", entete)).json());
    const sansTarif = candidats.modeles.find((m) => m.modele === "sans-tarif");
    expect(sansTarif?.tarifs).toEqual({ entree: null, sortie: null });
  });

  // ── La publication ────────────────────────────────────────────────────────

  /* LA règle, énoncée exactement (§4). Sans elle, « rien ne se publie sans
     essai » n'est qu'une phrase : on règle une consigne, on publie, et on
     découvre le dégât par le service client. */
  it("refuse la publication tant qu'aucun essai réussi ne porte l'empreinte", async () => {
    const { entete } = await session("admin");
    const brouillon = await brouillonner(reglages((r) => { r.consigneCommune = "jamais essayée"; }));

    const res = await appeler("POST", "/config/publish", entete, { configId: brouillon.id, note: MOTIF });
    expect(res.status).toBe(422);
    expect(await codeDe(res)).toBe("trial_required");
    expect((await db.prisma.studioConfig.findUniqueOrThrow({ where: { id: brouillon.id } })).state).toBe("draft");
  });

  /* Un `error` ou un `timeout` ne prouve RIEN sur ce que le réglage produit.
     Le compter reviendrait à publier parce qu'on a essayé, pas parce qu'on a
     vu. */
  it("ne compte pas un essai en échec", async () => {
    const { entete } = await session("admin");
    const brouillon = await brouillonner(reglages((r) => { r.consigneCommune = "essayée en vain"; }));
    await essaiSur(brouillon.id, "error");
    await essaiSur(brouillon.id, "timeout");
    await essaiSur(brouillon.id, "refused");

    const res = await appeler("POST", "/config/publish", entete, { configId: brouillon.id, note: MOTIF });
    expect(await codeDe(res)).toBe("trial_required");
  });

  it("publie dès qu'un essai réussi porte l'empreinte", async () => {
    const { entete, compte } = await session("admin");
    const brouillon = await brouillonner(reglages((r) => { r.consigneCommune = "vue tourner"; }));
    await essaiSur(brouillon.id, "success");

    const res = await appeler("POST", "/config/publish", entete, { configId: brouillon.id, note: MOTIF });
    expect(res.status).toBe(200);

    const apres = await db.prisma.studioConfig.findUniqueOrThrow({ where: { id: brouillon.id } });
    expect(apres.state).toBe("published");
    expect(apres.version).toBe(2);
    expect(apres.publishedByAdminId).toBe(compte.id);
    expect(apres.note).toBe(MOTIF);
    // Exactement une en service : l'ancienne a reculé.
    expect(await db.prisma.studioConfig.count({ where: { state: "published" } })).toBe(1);
    // Et plus de brouillon : le suivant naîtra de la prochaine prévisualisation.
    expect(await db.prisma.studioConfig.count({ where: { state: "draft" } })).toBe(0);
  });

  /* C'est ce qui rend la §3 praticable : un changement de libellé crée une
     ligne neuve, mais elle hérite de la couverture d'essai de la précédente
     puisque l'empreinte n'a pas bougé. Sans ce cas, réordonner l'écran
     exigerait de régénérer — et on ferait valider une image identique. */
  it("accepte un essai réussi venu d'un état ANTÉRIEUR à empreinte identique", async () => {
    const { entete } = await session("admin");
    const avant = await brouillonner(reglages((r) => { r.consigneCommune = "la même matière"; }));
    await essaiSur(avant.id, "success");
    // Un simple changement de libellé : nouvelle ligne, même empreinte.
    const apres = await brouillonner(reglages((r) => {
      r.consigneCommune = "la même matière";
      r.orientations[0]!.libelle.fr = "Ce qui nous lie";
    }));
    expect(apres.fingerprint).toBe(avant.fingerprint);

    const res = await appeler("POST", "/config/publish", entete, { configId: apres.id, note: MOTIF });
    expect(res.status).toBe(200);
  });

  /* Le motif est celui du journal : au moins six caractères. Un motif trop
     court doit faire tomber la publication AVANT que l'état ne bouge — c'est
     la transaction qui le garantit, et non l'ordre des lignes. */
  it("refuse une publication dont la note ne dit rien, et ne change rien", async () => {
    const { entete } = await session("admin");
    const brouillon = await brouillonner(reglages((r) => { r.consigneCommune = "vue tourner"; }));
    await essaiSur(brouillon.id, "success");

    const res = await appeler("POST", "/config/publish", entete, { configId: brouillon.id, note: "ok" });
    expect(res.status).toBe(422);
    expect(await codeDe(res)).toBe("reason_required");
    expect((await db.prisma.studioConfig.findUniqueOrThrow({ where: { id: brouillon.id } })).state).toBe("draft");
    expect(await db.prisma.auditLog.count()).toBe(0);
  });

  // ── Le retour arrière ─────────────────────────────────────────────────────

  /* « C'est la MÊME version qui revient, avec son numéro. » En fabriquer une
     nouvelle ferait cesser le numéro de désigner un contenu, et l'historique
     deviendrait illisible au bout de dix retours. */
  it("republie une version antérieure sans en créer une nouvelle", async () => {
    const { entete } = await session("admin");
    const un = await db.prisma.studioConfig.findFirstOrThrow({ where: { state: "published" } });
    const deux = await brouillonner(reglages((r) => { r.consigneCommune = "la seconde"; }));
    await essaiSur(deux.id, "success");
    await appeler("POST", "/config/publish", entete, { configId: deux.id, note: MOTIF });

    const avant = await db.prisma.studioConfig.count();
    const res = await appeler("POST", "/config/rollback", entete, { configId: un.id, reason: "la seconde déçoit" });
    expect(res.status).toBe(200);

    expect(await db.prisma.studioConfig.count()).toBe(avant);
    const revenue = await db.prisma.studioConfig.findUniqueOrThrow({ where: { id: un.id } });
    expect(revenue.state).toBe("published");
    expect(revenue.version).toBe(1);
    // `published_at` dit quand ce contenu est né, pas depuis quand il tourne :
    // le retour est un ÉVÉNEMENT, et c'est le journal qui le porte.
    expect(revenue.publishedAt?.getTime()).toBe(un.publishedAt?.getTime());
    expect(await db.prisma.auditLog.count({ where: { action: "studio_config_rollback" } })).toBe(1);
  });

  /* Revenir en arrière pendant que quelqu'un compose ne doit pas effacer son
     travail : c'est le geste qu'on fait dans l'urgence, et l'urgence est
     précisément le moment où quelqu'un d'autre est en train de régler. */
  it("ne touche pas au brouillon en cours", async () => {
    const { entete } = await session("admin");
    const un = await db.prisma.studioConfig.findFirstOrThrow({ where: { state: "published" } });
    const deux = await brouillonner(reglages((r) => { r.consigneCommune = "la seconde"; }));
    await essaiSur(deux.id, "success");
    await appeler("POST", "/config/publish", entete, { configId: deux.id, note: MOTIF });
    const encours = await brouillonner(reglages((r) => { r.consigneCommune = "dix minutes de travail"; }));

    await appeler("POST", "/config/rollback", entete, { configId: un.id, reason: "la seconde déçoit" });

    const apres = await db.prisma.studioConfig.findUniqueOrThrow({ where: { id: encours.id } });
    expect(apres.state).toBe("draft");
    expect(configs.reglagesDe(apres).consigneCommune).toBe("dix minutes de travail");
  });

  /* Un brouillon abandonné n'a jamais servi personne. Y « revenir » le
     mettrait en service sans qu'aucune publication ne l'ait validé — le
     contournement exact que la règle de publication interdit. */
  it("refuse de revenir sur une configuration jamais publiée", async () => {
    const { entete } = await session("admin");
    const brouillon = await brouillonner(reglages((r) => { r.consigneCommune = "jamais publiée"; }));

    const res = await appeler("POST", "/config/rollback", entete, { configId: brouillon.id, reason: MOTIF });
    expect(res.status).toBe(409);
    expect(await codeDe(res)).toBe("conflict");
  });

  // ── L'enregistrement direct ───────────────────────────────────────────────

  /* LA porte de service. Sans ce refus, on modifierait une consigne par le
     chemin « libellés », on publierait, et on aurait mis en production un texte
     que personne n'a vu tourner — en n'ayant enfreint aucune règle écrite. */
  it("refuse un enregistrement direct qui touche à ce que le modèle lit", async () => {
    const { entete } = await session("admin");

    const res = await appeler("PATCH", "/config", entete, {
      reglages: reglages((r) => { r.consigneCommune = "une consigne toute neuve"; }),
    });
    expect(res.status).toBe(422);
    expect(await codeDe(res)).toBe("trial_required");
    expect(await db.prisma.studioConfig.count({ where: { state: "draft" } })).toBe(0);
  });

  /* L'exception de la §3, et elle est nette : régénérer pour enregistrer un
     ordre d'affichage produirait une image identique à la précédente. */
  it("accepte un enregistrement direct qui ne change que ce que l'application lit", async () => {
    const { entete } = await session("admin");

    const res = await appeler("PATCH", "/config", entete, {
      reglages: reglages((r) => {
        r.orientations.reverse();
        r.orientations[0]!.libelle.fr = "Un autre mot";
        r.orientations[4]!.actif = false;
      }),
    });
    expect(res.status).toBe(200);
    const brouillon = await db.prisma.studioConfig.findFirstOrThrow({ where: { state: "draft" } });
    // La couverture d'essai de l'état précédent est héritée : même empreinte.
    const enService = await db.prisma.studioConfig.findFirstOrThrow({ where: { state: "published" } });
    expect(brouillon.fingerprint).toBe(enService.fingerprint);
  });

  // ── Les profils ───────────────────────────────────────────────────────────

  /* « Ce n'est pas une liste, c'est une couverture. » Les profils semés
     doivent couvrir les neuf axes du dictionnaire — sinon la première séance
     de réglage se fait sur trois fiches qui éprouvent la même chose. */
  it("sème des profils qui couvrent tout ce qui met un gabarit à l'épreuve", async () => {
    const { entete } = await session("admin");
    const page = profilsStudioSchema.parse(await (await appeler("GET", "/profiles", entete)).json());
    expect(page.manquant).toEqual([]);
  });

  /* La clé étrangère est en SET NULL, jamais en cascade : effacer les essais
     avec le profil rendrait d'un coup impubliables des configurations qu'on
     avait bel et bien vues tourner, et personne ne ferait le lien entre le
     ménage d'hier et le refus d'aujourd'hui. */
  it("garde les essais quand on supprime le profil qui les a servis", async () => {
    const { entete } = await session("admin");
    const brouillon = await brouillonner(reglages((r) => { r.consigneCommune = "vue tourner"; }));
    const profil = await db.prisma.studioProfile.findFirstOrThrow();
    await db.prisma.studioTrial.create({
      data: {
        studioConfigId: brouillon.id, studioProfileId: profil.id,
        provider: "anthropic", modelKey: "demande", status: "success",
      },
    });

    expect((await appeler("DELETE", `/profiles/${profil.id}`, entete)).status).toBe(204);

    expect(await db.prisma.studioTrial.count()).toBe(1);
    expect((await db.prisma.studioTrial.findFirstOrThrow()).studioProfileId).toBeNull();
    const res = await appeler("POST", "/config/publish", entete, { configId: brouillon.id, note: MOTIF });
    expect(res.status).toBe(200);
  });
});
