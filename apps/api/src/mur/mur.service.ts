import { Inject, Injectable } from "@nestjs/common";
import {
  NATURES_EXPOSABLES, type NatureExposable,
  type Wall, type UpdateWallInput, type PublicWall,
} from "@lehno/contracts";
import { PrismaService } from "../prisma/prisma.service.js";
import { FlagsService } from "../flags/flags.service.js";
import { AppError } from "../common/errors.js";
import { ajouterJours } from "../me/calendrier.js";
import { nouveauJeton } from "./jetons.js";

// Les délais de la fenêtre de vœux, tels que le dictionnaire les nomme. Lus en
// base à chaque appel comme ConfigService : écrits en dur, ils deviendraient
// faux le jour où l'administration les change, et une fenêtre fermée trop tôt
// ne se voit qu'à l'absence de vœux.
const LEAD_PAR_DEFAUT = 7;
const TRAIL_PAR_DEFAUT = 30;

export type Fenetre = {
  occurrenceId: string;
  date: string;
  ouvreLe: string;
  fermeLe: string;
  ouverte: boolean;
};

@Injectable()
export class MurService {
  // @Inject explicites : voir WishService — sous vitest/esbuild,
  // design:paramtypes n'est pas émis, et un paramètre typé sans jeton
  // explicite se résoudrait à `undefined` chez Nest.
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(FlagsService) private readonly flags: FlagsService,
    @Inject("PUBLIC_WEB_URL") private readonly siteUrl: string,
  ) {}

  private aujourdhui(): string {
    return new Date().toISOString().slice(0, 10);
  }

  /* La ligne naît À LA LECTURE, éteinte.
   *
   * Pas à l'inscription : un `Wall` créé pour chaque compte serait une ligne
   * morte pour tous ceux qui n'ouvriront jamais l'écran. Pas non plus à la
   * première PUBLICATION : l'écran doit pouvoir montrer l'adresse et le mot
   * d'accueil AVANT qu'on publie — c'est ce qui permet de savoir ce qu'on
   * s'apprête à ouvrir.
   *
   * `upsert` sur `userId`, qui est unique : deux ouvertures simultanées de
   * l'écran ne créent pas deux Murs, c'est la base qui tranche.
   */
  private async ligne(userId: string): Promise<{ isEnabled: boolean; showBirthdayDate: boolean; welcomeMessage: string | null }> {
    return this.prisma.wall.upsert({
      where: { userId },
      create: { userId },
      update: {},
      select: { isEnabled: true, showBirthdayDate: true, welcomeMessage: true },
    });
  }

  // La self-Person et ses goûts exposables. Un compte peut ne pas en avoir —
  // rien ne l'impose —, et l'écran doit alors s'afficher quand même.
  private async soi(userId: string) {
    return this.prisma.person.findFirst({
      where: { userId, isSelf: true },
      select: {
        id: true, displayName: true, callingName: true, birthDate: true,
        attributes: {
          where: { kind: { in: [...NATURES_EXPOSABLES] } },
          select: { id: true, kind: true, value: true, isPublic: true },
          orderBy: { kind: "asc" },
        },
      },
    });
  }

  /* La fenêtre de vœux de l'occasion EN COURS — celle dont la fenêtre contient
   * aujourd'hui, jamais la prochaine à venir.
   *
   * « Le Mur expose le lien de l'occurrence courante ; une nouvelle occurrence
   * chaque année ⇒ un nouveau lien. » Prendre la prochaine hors fenêtre
   * afficherait, en février, une invitation pour un anniversaire d'octobre :
   * les vœux arriveraient huit mois trop tôt et personne ne les lirait au bon
   * moment.
   *
   * Rend aussi les bornes quand la fenêtre est fermée : §3.9 demande de dire
   * QUAND, et une page qui ne connaît pas les dates ne peut pas le dire.
   */
  async fenetreCourante(userId: string): Promise<Fenetre | null> {
    const parametres = await this.prisma.systemParameter.findMany({
      where: { key: { in: ["wish_window_lead_days", "wish_window_trail_days"] } },
    });
    const jours = (cle: string, defaut: number): number => {
      const ligne = parametres.find((p) => p.key === cle);
      const valeur = ligne ? Number(ligne.value) : NaN;
      return Number.isFinite(valeur) ? valeur : defaut;
    };
    const lead = jours("wish_window_lead_days", LEAD_PAR_DEFAUT);
    const trail = jours("wish_window_trail_days", TRAIL_PAR_DEFAUT);

    const aujourdhui = this.aujourdhui();
    /* On cherche par la DATE D'OCCURRENCE encadrée, pas en listant tout : la
       fenêtre s'exprime en jours autour de la date, donc « aujourd'hui est
       dans la fenêtre » équivaut à « la date est entre aujourd'hui − trail et
       aujourd'hui + lead ». L'inverse — lister les occurrences puis filtrer en
       mémoire — ramènerait toute l'histoire du compte pour n'en garder qu'une. */
    const bas = ajouterJours(aujourdhui, -trail);
    const haut = ajouterJours(aujourdhui, lead);

    const occurrence = await this.prisma.eventOccurrence.findFirst({
      where: {
        userId,
        event: { kind: "birthday", person: { userId, isSelf: true } },
        occurrenceDate: { gte: new Date(`${bas}T00:00:00Z`), lte: new Date(`${haut}T00:00:00Z`) },
      },
      select: { id: true, occurrenceDate: true },
      orderBy: { occurrenceDate: "asc" },
    });
    if (!occurrence) return null;

    const date = occurrence.occurrenceDate.toISOString().slice(0, 10);
    const ouvreLe = ajouterJours(date, -lead);
    const fermeLe = ajouterJours(date, trail);
    return {
      occurrenceId: occurrence.id,
      date,
      ouvreLe,
      fermeLe,
      ouverte: aujourdhui >= ouvreLe && aujourdhui <= fermeLe,
    };
  }

  // ── L'espace privé ────────────────────────────────────────────────────────

  async get(userId: string): Promise<Wall> {
    const [mur, compte, moi] = await Promise.all([
      this.ligne(userId),
      this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { username: true } }),
      this.soi(userId),
    ]);

    // Le lien de vœux EXISTANT seulement : on ne le crée pas ici. Le créer
    // ferait naître un jeton sur un simple affichage d'écran, y compris quand
    // le drapeau `wishes` est éteint — un jeton vivant pour une surface fermée.
    const lien = await this.prisma.wishCollectionLink.findFirst({
      where: { userId, isActive: true },
      select: { token: true, occurrence: { select: { id: true } } },
    });
    const fenetre = await this.fenetreCourante(userId);

    return {
      slug: compte.username,
      isEnabled: mur.isEnabled,
      showBirthdayDate: mur.showBirthdayDate,
      welcomeMessage: mur.welcomeMessage,
      publicUrl: `${this.siteUrl}/${compte.username}`,
      wishLinkUrl:
        lien && fenetre && fenetre.ouverte && lien.occurrence.id === fenetre.occurrenceId
          ? `${this.siteUrl}/wish/${lien.token}`
          : null,
      interests: (moi?.attributes ?? []).map((a) => ({
        id: a.id,
        kind: a.kind as NatureExposable,
        value: a.value,
        isPublic: a.isPublic,
      })),
    };
  }

  async update(userId: string, input: UpdateWallInput): Promise<Wall> {
    await this.ligne(userId);

    /* Une SEULE transaction pour les deux moitiés du réglage.
     *
     * Publier le Mur et choisir ce qu'il montre sont un même geste à l'écran.
     * En deux écritures, un échec entre les deux publierait la page avec
     * l'ancienne sélection — exactement ce que « rien ne s'expose sans opt-in »
     * interdit. */
    await this.prisma.$transaction(async (tx) => {
      const champs: Record<string, unknown> = {};
      if (input.isEnabled !== undefined) champs["isEnabled"] = input.isEnabled;
      if (input.showBirthdayDate !== undefined) champs["showBirthdayDate"] = input.showBirthdayDate;
      if (input.welcomeMessage !== undefined) champs["welcomeMessage"] = input.welcomeMessage;
      if (Object.keys(champs).length > 0) {
        await tx.wall.update({ where: { userId }, data: champs });
      }

      if (input.publicInterestIds === undefined) return;

      /* La liste vaut pour L'ENSEMBLE : ce qui n'y figure pas redevient privé.
         Le périmètre est la self-Person du demandeur — jamais un identifiant
         nu venu du client, qui désignerait alors l'attribut d'un proche, voire
         d'un autre compte, et l'exposerait sur ce Mur-ci. */
      const exposables = await tx.personAttribute.findMany({
        where: {
          person: { userId, isSelf: true },
          kind: { in: [...NATURES_EXPOSABLES] },
        },
        select: { id: true },
      });
      const connus = new Set(exposables.map((a) => a.id));
      const inconnu = input.publicInterestIds.find((id) => !connus.has(id));
      if (inconnu) {
        /* On REFUSE plutôt qu'on n'ignore. Ignorer un identifiant inconnu
           laisserait une faute de frappe passer pour un succès, et l'écran
           afficherait comme exposé ce qui ne l'est pas — ou l'inverse, ce qui
           est pire. */
        throw new AppError("validation_failed", "unknown interest", {
          publicInterestIds: "does not belong to this account's own attributes",
        });
      }

      const aExposer = new Set(input.publicInterestIds);
      await tx.personAttribute.updateMany({
        where: { id: { in: [...connus].filter((id) => !aExposer.has(id)) } },
        data: { isPublic: false },
      });
      if (aExposer.size > 0) {
        await tx.personAttribute.updateMany({
          where: { id: { in: [...aExposer] } },
          data: { isPublic: true },
        });
      }
    });

    return this.get(userId);
  }

  /* L'aperçu : le Mur tel que le public le voit, MÊME NON PUBLIÉ.
   *
   * C'est tout l'objet de l'écran — savoir ce qu'on s'apprête à ouvrir avant
   * de l'ouvrir. Il passe donc par le même constructeur que la page publique,
   * jamais par une seconde composition : deux chemins vers la même page
   * finiraient par montrer deux choses, et l'aperçu mentirait.
   */
  async preview(userId: string): Promise<PublicWall> {
    const compte = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, username: true, displayName: true },
    });
    const mur = await this.ligne(userId);
    return this.composer({ ...compte, mur });
  }

  // ── La page publique ──────────────────────────────────────────────────────

  async parPseudo(username: string): Promise<PublicWall> {
    /* `status: active` fait partie du FILTRE, pas d'un test qui suivrait.
     *
     * Un compte suspendu ou en cours de suppression n'a plus de page : la
     * suspension serait sans effet si sa vitrine restait en ligne. Et l'absence
     * se confond avec la non-publication et avec le pseudo inconnu — un 404
     * dans les trois cas, sinon l'adresse dirait laquelle des trois. */
    const compte = await this.prisma.user.findFirst({
      where: { username, status: "active", wall: { isEnabled: true } },
      select: { id: true, username: true, displayName: true },
    });
    if (!compte) throw new AppError("not_found", "resource not found");
    const mur = await this.ligne(compte.id);
    return this.composer({ ...compte, mur });
  }

  private async composer(entree: {
    id: string;
    username: string;
    displayName: string | null;
    mur: { showBirthdayDate: boolean; welcomeMessage: string | null };
  }): Promise<PublicWall> {
    const moi = await this.soi(entree.id);

    /* Jour et mois, jamais l'année : le Mur annonce un ANNIVERSAIRE, pas une
       date de naissance. L'année dirait l'âge à tout visiteur, ce que §3.4 ne
       demande nulle part — elle parle d'une « simple mention ». */
    const naissance = moi?.birthDate ?? null;
    const birthday =
      entree.mur.showBirthdayDate && naissance
        ? naissance.toISOString().slice(5, 10)
        : null;

    /* Le jeton de dépôt de vœux, résolu ICI et non par le client : trois
       conditions doivent tenir ensemble — un lien vivant, une fenêtre ouverte,
       et le drapeau `wishes` allumé. Laisser le client en juger lui ferait
       proposer un bouton qui mène à un 404 le jour où l'une tombe. */
    const [fenetre, voeuxActifs] = await Promise.all([
      this.fenetreCourante(entree.id),
      this.flags.estActif("wishes"),
    ]);
    let wishLinkToken: string | null = null;
    if (voeuxActifs && fenetre?.ouverte) {
      const lien = await this.prisma.wishCollectionLink.findFirst({
        where: { eventOccurrenceId: fenetre.occurrenceId, isActive: true },
        select: { token: true },
      });
      wishLinkToken = lien?.token ?? null;
    }

    return {
      username: entree.username,
      // Le nom d'usage du compte, à défaut le pseudo. Jamais l'adresse
      // électronique : la page dit qui reçoit, pas comment le joindre.
      displayName: entree.displayName ?? entree.username,
      welcomeMessage: entree.mur.welcomeMessage,
      birthday,
      // `isPublic` est le filtre, et il est FAUX par défaut : un goût extrait
      // d'une note ne paraît que si son propriétaire l'a coché.
      interests: (moi?.attributes ?? [])
        .filter((a) => a.isPublic)
        .map((a) => ({ kind: a.kind as NatureExposable, value: a.value })),
      wishLinkToken,
    };
  }

  /* Le lien de dépôt de vœux de l'occasion en cours, créé à la demande DU
   * PROPRIÉTAIRE — jamais depuis la page publique. Une page publique qui écrit
   * laisserait n'importe quel visiteur faire naître des jetons.
   *
   * Hors fenêtre, il n'y a pas de lien : le créer donnerait une adresse à
   * partager qui refuserait tout dépôt.
   */
  async lienDeVoeux(userId: string): Promise<{ token: string; url: string; occurrenceId: string; closesOn: string }> {
    const fenetre = await this.fenetreCourante(userId);
    if (!fenetre || !fenetre.ouverte) {
      throw new AppError("wish_window_closed", "no open wish window for this account", {
        ...(fenetre ? { opensOn: fenetre.ouvreLe, closesOn: fenetre.fermeLe } : {}),
      });
    }
    // `upsert` sur l'occurrence, qui est unique : deux appels simultanés ne
    // créent pas deux jetons pour la même année.
    const lien = await this.prisma.wishCollectionLink.upsert({
      where: { eventOccurrenceId: fenetre.occurrenceId },
      create: { eventOccurrenceId: fenetre.occurrenceId, userId, token: nouveauJeton() },
      // Rouvre un lien révoqué plutôt que d'en frapper un second : le premier
      // circule déjà chez des proches, et un nouveau jeton les laisserait
      // devant une page morte sans qu'ils sachent pourquoi.
      update: { isActive: true },
      select: { token: true, eventOccurrenceId: true },
    });
    return {
      token: lien.token,
      url: `${this.siteUrl}/wish/${lien.token}`,
      occurrenceId: lien.eventOccurrenceId,
      closesOn: fenetre.fermeLe,
    };
  }
}
