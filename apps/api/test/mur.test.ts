import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { publicWallSchema, submissionSchema } from "@lehno/contracts";
import { MurService } from "../src/mur/mur.service.js";
import { CollecteService } from "../src/mur/collecte.service.js";
import { SubmissionService } from "../src/mur/submission.service.js";
import { VoeuxService } from "../src/mur/voeux.service.js";
import { SurfacePubliqueService } from "../src/mur/jetons.js";
import { RateLimitService } from "../src/common/rate-limit.service.js";
import { TenantRepository } from "../src/tenancy/tenant.repository.js";
import { FlagsService } from "../src/flags/flags.service.js";
import { AppError } from "../src/common/errors.js";

const SITE = "https://lehno.app";

// Le décalage en jours, en date civile — même arithmétique que le service,
// pour que les cas ne dépendent pas du jour où ils tournent.
function jour(decalage: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + decalage);
  return new Date(`${d.toISOString().slice(0, 10)}T00:00:00Z`);
}

describe("le Mur et la collecte", () => {
  let db: TestDb;
  let mur: MurService;
  let collecte: CollecteService;
  let soumissions: SubmissionService;
  let voeux: VoeuxService;
  let awa: string;
  let bila: string;

  const compte = async (username?: string): Promise<string> => {
    const u = await db.prisma.user.create({
      data: {
        email: `${randomBytes(6).toString("hex")}@example.com`,
        username: username ?? `u${randomBytes(4).toString("hex")}`,
        referralCode: randomBytes(4).toString("hex").toUpperCase(),
      },
    });
    return u.id;
  };

  // La self-Person, avec sa naissance et son anniversaire ouvert à `dans`
  // jours. C'est ce qui donne au compte une fenêtre de vœux.
  const soi = async (userId: string, dans: number) => {
    const p = await db.prisma.person.create({
      data: { userId, displayName: "Awa", isSelf: true, birthDate: jour(dans) },
    });
    const e = await db.prisma.event.create({
      data: { personId: p.id, kind: "birthday", referenceDate: jour(dans) },
    });
    const o = await db.prisma.eventOccurrence.create({
      data: { eventId: e.id, userId, occurrenceDate: jour(dans) },
    });
    return { personId: p.id, occurrenceId: o.id };
  };

  beforeAll(async () => { db = await withDatabase(); }, 120_000);
  afterAll(async () => { await db.close(); });

  beforeEach(async () => {
    await resetDatabase(db.prisma);
    const drapeaux = new FlagsService(db.prisma as never);
    await drapeaux.reconcilier();
    // Les trois drapeaux du domaine, allumés : ces cas éprouvent les règles,
    // pas l'extinction — celle-ci a son propre fichier, au niveau HTTP, parce
    // qu'elle se joue dans un garde et non dans un service.
    for (const key of ["wall", "collect", "wishes"]) {
      await db.prisma.featureFlag.update({ where: { key }, data: { enabled: true } });
    }
    /* Les bornes de la fenêtre, posées explicitement plutôt que laissées au
       hasard du référentiel : un cas qui ne mord qu'une fois sur deux, selon
       ce que la migration a semé, est pire qu'absent. */
    for (const [key, value] of [["wish_window_lead_days", "7"], ["wish_window_trail_days", "30"]]) {
      await db.prisma.systemParameter.upsert({
        where: { key: key! },
        create: { key: key!, value: value!, valueType: "number" },
        update: { value: value! },
      });
    }

    const depot = new TenantRepository(db.prisma as never);
    const surface = new SurfacePubliqueService(new RateLimitService(db.prisma as never));
    mur = new MurService(db.prisma as never, new FlagsService(db.prisma as never), SITE);
    collecte = new CollecteService(db.prisma as never, depot, surface);
    soumissions = new SubmissionService(db.prisma as never);
    voeux = new VoeuxService(db.prisma as never, surface);

    awa = await compte("awa");
    bila = await compte("bila");
  });

  // ── Le Mur ────────────────────────────────────────────────────────────────

  /* Garde le défaut ÉTEINT. Un Mur qui naîtrait publié exposerait la self-Person
     de tous les comptes le jour où la table apparaît, sans que personne l'ait
     demandé — « rien ne s'expose sans opt-in ». */
  it("naît non publié, et sa page est alors introuvable", async () => {
    const vu = await mur.get(awa);
    expect(vu.isEnabled).toBe(false);
    expect(vu.publicUrl).toBe(`${SITE}/awa`);
    await expect(mur.parPseudo("awa")).rejects.toMatchObject({ code: "not_found" });
  });

  /* Garde le 404 sur le Mur d'un compte SUSPENDU. Une suspension qui laisse la
     vitrine en ligne n'est pas une suspension : le compte est fermé, sa page
     doit l'être avec lui. */
  it("ne sert pas le Mur d'un compte suspendu ni d'un compte en suppression", async () => {
    await mur.update(awa, { isEnabled: true });
    expect((await mur.parPseudo("awa")).username).toBe("awa");

    await db.prisma.user.update({ where: { id: awa }, data: { status: "suspended" } });
    await expect(mur.parPseudo("awa")).rejects.toMatchObject({ code: "not_found" });

    await db.prisma.user.update({ where: { id: awa }, data: { status: "pending_deletion" } });
    await expect(mur.parPseudo("awa")).rejects.toMatchObject({ code: "not_found" });
  });

  /* Garde l'ANNÉE hors de la page. Servir la date de naissance entière dirait
     l'âge à tout visiteur, alors que §3.4 ne demande qu'une « simple mention »
     de l'anniversaire. */
  it("n'expose que le jour et le mois de l'anniversaire, jamais l'année", async () => {
    await soi(awa, 10);
    await db.prisma.person.updateMany({
      where: { userId: awa, isSelf: true },
      data: { birthDate: new Date("1990-03-14T00:00:00Z") },
    });
    await mur.update(awa, { isEnabled: true });

    const page = await mur.parPseudo("awa");
    expect(publicWallSchema.safeParse(page).success).toBe(true);
    expect(page.birthday).toBe("03-14");
    expect(JSON.stringify(page)).not.toContain("1990");
  });

  /* Garde le défaut PRIVÉ des goûts. Un attribut est extrait d'une note écrite
     pour soi : personne ne l'a rédigé pour des inconnus. Sans ce cas, un
     `isPublic` passé à `true` par défaut publierait tout le carnet de soi. */
  it("garde les goûts privés tant qu'ils ne sont pas cochés", async () => {
    const { personId } = await soi(awa, 10);
    const a = await db.prisma.personAttribute.create({
      data: { personId, kind: "hobby", value: "la randonnée", observedAt: jour(0) },
    });
    await mur.update(awa, { isEnabled: true });

    expect((await mur.parPseudo("awa")).interests).toHaveLength(0);
    // L'écran de gestion, lui, les voit tous : c'est là qu'on coche.
    expect((await mur.get(awa)).interests).toHaveLength(1);

    await mur.update(awa, { publicInterestIds: [a.id] });
    expect((await mur.parPseudo("awa")).interests).toEqual([{ kind: "hobby", value: "la randonnée" }]);

    // La liste vaut pour l'ensemble : ce qui n'y figure plus redevient privé.
    await mur.update(awa, { publicInterestIds: [] });
    expect((await mur.parPseudo("awa")).interests).toHaveLength(0);
  });

  /* Garde le CLOISONNEMENT du réglage de visibilité. Sans le filtre sur la
     self-Person du demandeur, un identifiant nu venu du client exposerait
     l'attribut d'un proche — ou celui d'un autre compte — sur ce Mur-ci. */
  it("refuse d'exposer un goût qui n'est pas le sien", async () => {
    const chezBila = await soi(bila, 10);
    const sien = await db.prisma.personAttribute.create({
      data: { personId: chezBila.personId, kind: "food", value: "le poisson braisé", observedAt: jour(0) },
    });
    await soi(awa, 10);

    await expect(mur.update(awa, { publicInterestIds: [sien.id] }))
      .rejects.toMatchObject({ code: "validation_failed" });
    // Et rien n'a bougé chez l'autre.
    const apres = await db.prisma.personAttribute.findUniqueOrThrow({ where: { id: sien.id } });
    expect(apres.isPublic).toBe(false);
  });

  /* Garde le fait que L'APERÇU passe par le même constructeur que la page
     publique. Deux compositions distinctes finiraient par montrer deux choses,
     et l'aperçu mentirait au moment précis où on lui fait confiance. */
  it("montre l'aperçu même non publié, et il dit la même chose que la page", async () => {
    const { personId } = await soi(awa, 10);
    const a = await db.prisma.personAttribute.create({
      data: { personId, kind: "color", value: "le bleu", observedAt: jour(0) },
    });
    await mur.update(awa, { publicInterestIds: [a.id] });

    const apercu = await mur.preview(awa);
    expect(apercu.interests).toEqual([{ kind: "color", value: "le bleu" }]);

    await mur.update(awa, { isEnabled: true });
    expect(await mur.parPseudo("awa")).toEqual(apercu);
  });

  // ── Le lien de dépôt de vœux ──────────────────────────────────────────────

  /* Garde le fait qu'AUCUNE PAGE PUBLIQUE N'ÉCRIT. Si la page du Mur créait le
     jeton à la volée, n'importe quel visiteur en ferait naître, et un compte
     sans anniversaire proche verrait des lignes apparaître à chaque passage. */
  it("ne fait pas naître de lien de vœux depuis la page publique", async () => {
    await soi(awa, 2);
    await mur.update(awa, { isEnabled: true });

    expect((await mur.parPseudo("awa")).wishLinkToken).toBeNull();
    expect(await db.prisma.wishCollectionLink.count()).toBe(0);

    const lien = await mur.lienDeVoeux(awa);
    expect((await mur.parPseudo("awa")).wishLinkToken).toBe(lien.token);
  });

  /* Garde le refus HORS FENÊTRE. Créer le lien quand même donnerait une adresse
     à partager qui refuserait tout dépôt — le proche cliquerait, écrirait, et
     se ferait renvoyer. */
  it("ne donne pas de lien de vœux hors de la fenêtre", async () => {
    await soi(awa, 200);
    await expect(mur.lienDeVoeux(awa)).rejects.toMatchObject({ code: "wish_window_closed" });
    expect(await db.prisma.wishCollectionLink.count()).toBe(0);
  });

  /* Garde la RÉOUVERTURE plutôt que le remplacement. Un second jeton laisserait
     les proches qui ont gardé le premier devant une page morte, sans savoir
     pourquoi. */
  it("rouvre le lien de vœux existant au lieu d'en frapper un second", async () => {
    await soi(awa, 2);
    const premier = await mur.lienDeVoeux(awa);
    await db.prisma.wishCollectionLink.updateMany({ where: { userId: awa }, data: { isActive: false } });
    const second = await mur.lienDeVoeux(awa);
    expect(second.token).toBe(premier.token);
    expect(await db.prisma.wishCollectionLink.count()).toBe(1);
  });

  // ── Les liens de collecte ─────────────────────────────────────────────────

  /* Garde les TROIS ISSUES d'un jeton, et l'écart entre elles.
     Inconnu → 404, sinon le chemin devient un oracle à jetons : on saurait
     qu'un lien existe rien qu'en essayant. Révoqué → 410, parce que le visiteur
     a reçu ce lien de quelqu'un et que « introuvable » lui ferait croire à une
     faute de frappe. */
  it("distingue un jeton inconnu d'un jeton révoqué, et le dit par le statut", async () => {
    const p = await db.prisma.person.create({ data: { userId: awa, displayName: "Bila" } });
    const lien = await collecte.create(awa, { type: "nominatif", personId: p.id });

    expect((await collecte.formulaire(lien.token)).type).toBe("nominatif");

    await expect(collecte.formulaire("jetoninconnu")).rejects.toMatchObject({ code: "not_found" });
    expect(new AppError("not_found", "x").status).toBe(404);

    await collecte.revoke(awa, lien.id);
    await expect(collecte.formulaire(lien.token)).rejects.toMatchObject({ code: "link_revoked" });
    expect(new AppError("link_revoked", "x").status).toBe(410);
  });

  // Garde le fait que la collecte d'un compte suspendu se ferme avec lui.
  it("ferme la collecte d'un compte suspendu", async () => {
    const p = await db.prisma.person.create({ data: { userId: awa, displayName: "Bila" } });
    const lien = await collecte.create(awa, { type: "nominatif", personId: p.id });
    await db.prisma.user.update({ where: { id: awa }, data: { status: "suspended" } });
    await expect(collecte.formulaire(lien.token)).rejects.toMatchObject({ code: "not_found" });
  });

  /* Garde le CLOISONNEMENT de la création et de la révocation : la fiche d'un
     autre compte ne doit pas pouvoir recevoir un lien, et le lien d'un autre ne
     doit pas pouvoir se révoquer — en 404, jamais en 403. */
  it("ne laisse personne ouvrir ni révoquer le lien d'un autre", async () => {
    const chezBila = await db.prisma.person.create({ data: { userId: bila, displayName: "Awa" } });
    await expect(collecte.create(awa, { type: "nominatif", personId: chezBila.id }))
      .rejects.toMatchObject({ code: "not_found" });

    const sien = await collecte.create(bila, { type: "nominatif", personId: chezBila.id });
    await expect(collecte.revoke(awa, sien.id)).rejects.toMatchObject({ code: "not_found" });
    expect((await db.prisma.collectionLink.findUniqueOrThrow({ where: { id: sien.id } })).isActive).toBe(true);
  });

  /* Garde la RÉOUVERTURE du lien de collecte. §3.20 dit « lien révoqué
     (réactivable) » : le jeton circule déjà chez le proche, souvent en favori,
     et c'est par lui qu'il relit le sort de ses souhaits. En frapper un second
     couperait ses contributions passées du lien qu'il détient. */
  it("rouvre le lien du même proche avec le même jeton", async () => {
    const p = await db.prisma.person.create({ data: { userId: awa, displayName: "Bila" } });
    const premier = await collecte.create(awa, { type: "nominatif", personId: p.id });
    await collecte.revoke(awa, premier.id);
    const second = await collecte.create(awa, { type: "nominatif", personId: p.id });

    expect(second.token).toBe(premier.token);
    expect(second.isActive).toBe(true);
    expect(await db.prisma.collectionLink.count({ where: { userId: awa } })).toBe(1);
  });

  /* Garde la FRONTIÈRE du lien public : il se partage au monde, donc il ne
     montre aucune fiche. Servir le nom ou la date exposerait un proche à
     quiconque relaie l'adresse. */
  it("ne montre aucune fiche sur un lien public", async () => {
    const p = await db.prisma.person.create({
      data: { userId: awa, displayName: "Bila", birthDate: new Date("1990-03-14T00:00:00Z") },
    });
    const nominatif = await collecte.create(awa, { type: "nominatif", personId: p.id });
    const publik = await collecte.create(awa, { type: "public" });

    const vuNominatif = await collecte.formulaire(nominatif.token);
    expect(vuNominatif.personDisplayName).toBe("Bila");
    expect(vuNominatif.birthDate).toBe("1990-03-14");

    const vuPublic = await collecte.formulaire(publik.token);
    expect(vuPublic.personDisplayName).toBeNull();
    expect(vuPublic.birthDate).toBeNull();
  });

  // ── Ce qui arrive d'un inconnu ────────────────────────────────────────────

  /* Garde les DEUX filtres à robots, et le fait qu'ils rendent LE MÊME code.
     Deux libellés distincts diraient au robot lequel a mordu, et il
     s'ajusterait en une soumission. */
  it("écarte le robot sans lui dire lequel des deux filtres a mordu", async () => {
    const publik = await collecte.create(awa, { type: "public" });

    const leurre = await collecte
      .soumettre(publik.token, { personalNote: "salut", website: "http://spam" })
      .catch((e: AppError) => e);
    const tropVite = await collecte
      .soumettre(publik.token, { personalNote: "salut", renderedAt: Date.now() })
      .catch((e: AppError) => e);

    expect((leurre as AppError).code).toBe("collect_rejected");
    expect((tropVite as AppError).code).toBe("collect_rejected");
    expect((leurre as AppError).message).toBe((tropVite as AppError).message);
    expect(await db.prisma.submission.count()).toBe(0);
  });

  /* Garde le fait que le pseudo auto-déclaré N'EST PAS résolu à l'arrivée. Le
     résoudre là ferait d'un inconnu l'auteur d'une contribution qu'il n'a pas
     écrite : n'importe qui peut taper le pseudo de n'importe qui. */
  it("ne rattache aucun compte au dépôt, même quand le pseudo existe", async () => {
    const publik = await collecte.create(awa, { type: "public" });
    await collecte.soumettre(publik.token, { personalNote: "salut", submitterUsername: "bila" });

    const ligne = await db.prisma.submission.findFirstOrThrow({});
    expect(ligne.submitterUsername).toBe("bila");
    // Aucune note, aucun souhait : rien n'est entré nulle part sans décision.
    expect(await db.prisma.note.count()).toBe(0);
    expect(await db.prisma.wishlistItem.count()).toBe(0);
  });

  /* Garde la FRONTIÈRE de la relecture. Sur un lien public, servir les
     contributions ferait lire à tout visiteur le nom, le mot et les souhaits
     des autres — le lien est fait pour être partagé au monde. */
  it("ne laisse relire ses contributions que par un lien nominatif", async () => {
    const p = await db.prisma.person.create({ data: { userId: awa, displayName: "Bila" } });
    const nominatif = await collecte.create(awa, { type: "nominatif", personId: p.id });
    const publik = await collecte.create(awa, { type: "public" });

    await collecte.soumettre(nominatif.token, { personalNote: "il aime le vélo" });
    await collecte.soumettre(publik.token, { personalNote: "moi je passais par là", submitterName: "Inconnu" });

    const relu = await collecte.relire(nominatif.token);
    expect(relu.submissions).toHaveLength(1);
    await expect(collecte.relire(publik.token)).rejects.toMatchObject({ code: "not_found" });
  });

  // Garde l'adresse et le pseudo hors de la relecture : le lien peut être
  // transféré, et ce chemin deviendrait sinon un moyen de les LIRE.
  it("ne redit ni l'adresse ni le pseudo du répondant à la relecture", async () => {
    const p = await db.prisma.person.create({ data: { userId: awa, displayName: "Bila" } });
    const lien = await collecte.create(awa, { type: "nominatif", personId: p.id });
    await collecte.soumettre(lien.token, {
      personalNote: "salut", submitterEmail: "bila@example.com", submitterUsername: "bila",
    });

    const relu = JSON.stringify(await collecte.relire(lien.token));
    expect(relu).not.toContain("bila@example.com");
    expect(relu).not.toContain("bila");
  });

  // ── La validation ─────────────────────────────────────────────────────────

  const contribution = async (options: { nominatif: boolean } = { nominatif: true }) => {
    const p = options.nominatif
      ? await db.prisma.person.create({ data: { userId: awa, displayName: "Bila" } })
      : null;
    const lien = options.nominatif
      ? await collecte.create(awa, { type: "nominatif", personId: p!.id })
      : await collecte.create(awa, { type: "public" });
    await collecte.soumettre(lien.token, {
      birthDate: jour(20).toISOString().slice(0, 10),
      personalNote: "il joue de la kora",
      wishes: [{ label: "un livre" }, { label: "un ballon" }],
      ...(options.nominatif ? {} : { submitterName: "Fatou", relationHint: "la fac" }),
    });
    const [s] = await soumissions.list(awa);
    return { personId: p?.id ?? null, submission: s! };
  };

  /* LE cas central : la répartition tient en une seule transaction, et la
     décision porte sur l'ensemble. Sans elle, une panne au milieu laisserait la
     date écrite, le mot perdu, un souhait sur deux rangé — et la contribution
     marquée validée par-dessus. */
  it("répartit tout d'un coup : la date, le mot et chaque souhait", async () => {
    const { personId, submission } = await contribution();
    const [livre, ballon] = submission.wishes;

    const apres = await soumissions.decide(awa, submission.id, {
      keepBirthDate: true,
      keepPersonalNote: true,
      wishes: [
        { id: livre!.id, reviewStatus: "retained" },
        { id: ballon!.id, reviewStatus: "discarded" },
      ],
    });

    expect(submissionSchema.safeParse(apres).success).toBe(true);
    expect(apres.status).toBe("validated");

    const proche = await db.prisma.person.findUniqueOrThrow({ where: { id: personId! } });
    expect(proche.birthDate?.toISOString().slice(0, 10)).toBe(jour(20).toISOString().slice(0, 10));

    // La naissance seule ne suffit pas : sans anniversaire, la fiche
    // n'apparaîtrait dans aucune échéance et l'utilisateur croirait sa
    // validation perdue.
    const anniversaire = await db.prisma.event.findFirst({ where: { personId: personId!, kind: "birthday" } });
    expect(anniversaire).not.toBeNull();

    const souhaits = await db.prisma.wishlistItem.findMany({});
    expect(souhaits).toHaveLength(1);
    expect(souhaits[0]!.label).toBe("un livre");
    expect(souhaits[0]!.origin).toBe("collected");

    const notes = await db.prisma.note.findMany({});
    expect(notes).toHaveLength(1);
    expect(notes[0]!.content).toBe("il joue de la kora");

    // Le souhait écarté GARDE sa trace : c'est elle que le répondant relit.
    const ecarte = await db.prisma.submittedWish.findUniqueOrThrow({ where: { id: ballon!.id } });
    expect(ecarte.reviewStatus).toBe("discarded");
    expect(ecarte.wishlistItemId).toBeNull();
  });

  /* Garde contre la VALIDATION PARTIELLE. Un souhait laissé « en attente » sur
     une contribution close ne reparaîtrait dans aucune file : le propriétaire
     ne le reverrait jamais, et le répondant lirait indéfiniment « en cours
     d'examen ». Et le refus doit ne RIEN laisser derrière lui. */
  it("refuse une décision qui laisse un souhait non tranché, sans rien écrire", async () => {
    const { submission } = await contribution();
    const [livre] = submission.wishes;

    await expect(soumissions.decide(awa, submission.id, {
      keepBirthDate: true,
      wishes: [{ id: livre!.id, reviewStatus: "retained" }],
    })).rejects.toMatchObject({ code: "validation_failed" });

    // Rien à moitié fait : ni souhait rangé, ni naissance écrite, ni statut changé.
    expect(await db.prisma.wishlistItem.count()).toBe(0);
    const proche = await db.prisma.person.findFirstOrThrow({ where: { userId: awa } });
    expect(proche.birthDate).toBeNull();
    expect((await soumissions.get(awa, submission.id)).status).toBe("pending");
    expect((await soumissions.get(awa, submission.id)).wishes.every((w) => w.reviewStatus === "pending")).toBe(true);
  });

  /* Garde contre le REJEU. Un double appui, ou un client qui réessaie après un
     délai, rangerait les souhaits une seconde fois dans la fiche. */
  it("ne tranche une contribution qu'une fois", async () => {
    const { submission } = await contribution();
    const decision = {
      keepBirthDate: true,
      wishes: submission.wishes.map((w) => ({ id: w.id, reviewStatus: "retained" as const })),
    };
    await soumissions.decide(awa, submission.id, decision);
    await expect(soumissions.decide(awa, submission.id, decision))
      .rejects.toMatchObject({ code: "conflict" });
    expect(await db.prisma.wishlistItem.count()).toBe(2);
  });

  // Garde le rejet en bloc : il emporte les souhaits encore en attente, sinon
  // le répondant lirait « en cours d'examen » sur une contribution close.
  it("écarte tous les souhaits d'une contribution rejetée", async () => {
    const { submission } = await contribution();
    const apres = await soumissions.decide(awa, submission.id, { reject: true });

    expect(apres.status).toBe("rejected");
    expect(apres.wishes.every((w) => w.reviewStatus === "discarded")).toBe(true);
    expect(await db.prisma.wishlistItem.count()).toBe(0);
    expect(await db.prisma.note.count()).toBe(0);
  });

  /* Garde le CLOISONNEMENT de la file de validation : la contribution d'un
     autre compte n'existe pas, et son identifiant ne doit pas devenir un
     oracle. */
  it("ne laisse personne lire ni trancher la contribution d'un autre", async () => {
    const { submission } = await contribution();
    await expect(soumissions.get(bila, submission.id)).rejects.toMatchObject({ code: "not_found" });
    await expect(soumissions.decide(bila, submission.id, { reject: true }))
      .rejects.toMatchObject({ code: "not_found" });
    expect((await soumissions.get(awa, submission.id)).status).toBe("pending");
  });

  /* Garde la création de fiche depuis un lien PUBLIC, et le refus de la
     détourner. Sur un nominatif, `personId` rangerait chez l'un ce qu'un autre
     a écrit. */
  it("ouvre une fiche depuis un lien public, et refuse de détourner un nominatif", async () => {
    const { submission } = await contribution({ nominatif: false });
    const ailleurs = await db.prisma.person.create({ data: { userId: awa, displayName: "Ailleurs" } });

    const nominative = await contribution();
    await expect(soumissions.decide(awa, nominative.submission.id, {
      personId: ailleurs.id,
      keepBirthDate: true,
      wishes: nominative.submission.wishes.map((w) => ({ id: w.id, reviewStatus: "discarded" as const })),
    })).rejects.toMatchObject({ code: "validation_failed" });

    await soumissions.decide(awa, submission.id, {
      keepBirthDate: true,
      wishes: submission.wishes.map((w) => ({ id: w.id, reviewStatus: "discarded" as const })),
    });
    const fatou = await db.prisma.person.findFirst({ where: { userId: awa, displayName: "Fatou" } });
    expect(fatou).not.toBeNull();
    // « On se connaît d'où » garde sa nuance : l'écraser en énumération
    // perdrait ce que le répondant a pris la peine d'écrire.
    expect(fatou!.relationHint).toBe("la fac");
  });

  // ── Le dépôt de vœux ──────────────────────────────────────────────────────

  /* Garde le fait que la page S'OUVRE hors fenêtre pour DIRE quand revenir, et
     que c'est le dépôt — pas la lecture — qui refuse. Une lecture qui échoue
     laisse le visiteur repartir sans savoir s'il doit réessayer. */
  it("ouvre la page hors fenêtre mais n'accepte pas le message", async () => {
    const { occurrenceId } = await soi(awa, 2);
    const lien = await mur.lienDeVoeux(awa);

    // On recule l'occasion très loin dans le passé : la fenêtre se ferme, le
    // lien reste vivant. Déterministe, sans dépendre du jour où le cas tourne.
    await db.prisma.eventOccurrence.update({
      where: { id: occurrenceId }, data: { occurrenceDate: jour(-400) },
    });

    const page = await voeux.formulaire(lien.token);
    expect(page.isOpen).toBe(false);
    expect(page.windowClosesOn).toBe(jour(-370).toISOString().slice(0, 10));

    await expect(voeux.deposer(lien.token, { content: "bon anniversaire" }))
      .rejects.toMatchObject({ code: "wish_window_closed" });
    expect(await db.prisma.receivedWish.count()).toBe(0);
  });

  // Garde le fait qu'un vœu arrive EN ATTENTE, et qu'il ne paraît nulle part
  // avant décision : le Mur n'a pas de livre d'or.
  it("laisse un vœu en attente, et le Mur n'en montre rien", async () => {
    await soi(awa, 2);
    const lien = await mur.lienDeVoeux(awa);
    await mur.update(awa, { isEnabled: true });

    await voeux.deposer(lien.token, { content: "bon anniversaire !", authorName: "Fatou" });

    const [recu] = await voeux.list(awa);
    expect(recu!.status).toBe("pending");
    expect(JSON.stringify(await mur.parPseudo("awa"))).not.toContain("bon anniversaire");
  });

  // Garde le rattachement de compte hors du dépôt : la page est publique, et
  // un nom tapé ne fait signer personne.
  it("ne fait signer aucun compte sur la foi d'un nom tapé", async () => {
    await soi(awa, 2);
    const lien = await mur.lienDeVoeux(awa);
    await voeux.deposer(lien.token, { content: "bravo", authorName: "bila" });
    const ligne = await db.prisma.receivedWish.findFirstOrThrow({});
    expect(ligne.authorUserId).toBeNull();
  });

  // Garde contre le rejeu de la modération : sans elle, un vœu rejeté pourrait
  // revenir approuvé, et la modération n'enregistrerait que le dernier avis.
  it("ne modère un vœu qu'une fois", async () => {
    await soi(awa, 2);
    const lien = await mur.lienDeVoeux(awa);
    await voeux.deposer(lien.token, { content: "bravo" });
    const [recu] = await voeux.list(awa);

    expect((await voeux.decide(awa, recu!.id, { decision: "rejected" })).status).toBe("rejected");
    await expect(voeux.decide(awa, recu!.id, { decision: "approved" }))
      .rejects.toMatchObject({ code: "conflict" });
  });

  // Garde le cloisonnement des vœux reçus : ceux d'un autre n'existent pas.
  it("ne laisse personne modérer le vœu d'un autre", async () => {
    await soi(awa, 2);
    const lien = await mur.lienDeVoeux(awa);
    await voeux.deposer(lien.token, { content: "bravo" });
    const [recu] = await voeux.list(awa);

    await expect(voeux.decide(bila, recu!.id, { decision: "approved" }))
      .rejects.toMatchObject({ code: "not_found" });
    expect(await voeux.list(bila)).toHaveLength(0);
  });

  // Mêmes trois issues que la collecte, sur l'autre canal : le raisonnement
  // vaut mot pour mot, et une divergence entre les deux surfaces se verrait ici.
  it("distingue aussi le jeton de vœux inconnu du jeton révoqué", async () => {
    await soi(awa, 2);
    const lien = await mur.lienDeVoeux(awa);

    await expect(voeux.formulaire("jetoninconnu")).rejects.toMatchObject({ code: "not_found" });
    await db.prisma.wishCollectionLink.updateMany({ where: { userId: awa }, data: { isActive: false } });
    await expect(voeux.formulaire(lien.token)).rejects.toMatchObject({ code: "link_revoked" });
  });
});
