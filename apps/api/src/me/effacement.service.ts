import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { randomBytes } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service.js";
import { delaiDeGraceEnJours } from "../common/delai-de-grace.js";

/* L'effacement réel des comptes supprimés.
 *
 * C'est le seul engagement du produit qui s'exerce EN DROIT : la politique de
 * confidentialité §7 promet que les fiches, notes et souhaits sont « effacés à
 * la suppression du compte », et la spec technique §9.11 exige une « suppression
 * réellement effective au terme du délai de grâce ». Avant ce fichier, le geste
 * d'administration posait `status = 'deleted'` et rien ne partait.
 *
 * TROIS RÈGLES GOUVERNENT TOUT CE QUI SUIT.
 *
 * 1. « Effacer » et « anonymiser » ne sont pas la même chose. Ce qui est à
 *    l'utilisateur part. Ce qui FAIT FOI — le journal d'audit, les pièces
 *    comptables, les mouvements de crédits — reste : §4 les range sous
 *    « obligation légale », et §7 leur donne une durée propre, distincte du
 *    droit à l'effacement. Ce qui fonde une PROTECTION — le plafond de comptes
 *    par appareil — reste aussi, mais délié du compte : §9.11 le dit sans
 *    détour, « un plafond dont les traces s'effacent avec les comptes se
 *    contourne en créant puis supprimant ».
 *
 * 2. LA LIGNE `user` N'EST JAMAIS SUPPRIMÉE. `payment`, `payment_status_history`,
 *    `credit_transaction`, `referral` et `action_run` la référencent en CASCADE :
 *    un `user.delete()` emporterait tout l'historique comptable en silence. Elle
 *    est donc VIDÉE sur place — c'est le seul moyen de tenir §7 sans détruire ce
 *    que §7 réserve dans la même phrase.
 *
 * 3. AUCUNE ÉTAPE NE SUPPOSE QUE LA PRÉCÉDENTE A EU LIEU. Chacune est un
 *    `deleteMany` ou un `updateMany` sur un critère stable : la rejouer sur un
 *    compte déjà traité ne fait rien. Le marqueur `erasedAt` s'écrit en dernier.
 *    Un passage interrompu au milieu laisse donc un compte à moitié vidé que le
 *    passage suivant reprend du début — et un compte à moitié effacé qui ne se
 *    reprend pas est pire que rien.
 *
 * CE QUE CETTE TÂCHE NE PEUT PAS ENCORE ATTEINDRE. Nommé ici plutôt que passé
 * sous silence : une promesse à moitié tenue qu'on croit tenue est pire qu'un
 * écart connu.
 *
 * - LES FICHIERS. §9.11 promet un effacement « jusqu'aux fichiers stockés ».
 *   Aucun stockage d'objets n'existe dans le dépôt : `user.avatarUrl`,
 *   `person.avatarUrl`, `wishlist_item.imageUrl`, `payment.proofKey` et
 *   `data_export_request.fileUrl` sont des adresses vers un ailleurs que rien
 *   ici ne sait joindre. Les RÉFÉRENCES partent, les fichiers restent. Le jour
 *   où le stockage arrive, il se branche à l'étape 2.
 * - LE MUR ET LES VŒUX REÇUS. §7 promet que les « vœux reçus » et les
 *   « contributions par lien de collecte » sont effacés à la suppression. Ni la
 *   table des Murs ni celle des liens de collecte n'existent — le back-office le
 *   dit déjà lui-même (`volumetrie.murs: null`). Il n'y a rien à effacer parce
 *   qu'il n'y a rien du tout.
 * - LA LISTE D'ATTENTE. `waitlist_signup` porte l'adresse du titulaire et n'est
 *   PAS touchée. Son `email_canonical` est l'unique garde-fou du cadeau de
 *   lancement — le même raisonnement que DeviceSignup : le remplacer laisserait
 *   se réinscrire et toucher le cadeau une seconde fois. L'adresse survit donc à
 *   l'effacement, et c'est un écart réel, assumé faute d'une clé d'anti-abus qui
 *   ne soit pas l'adresse elle-même.
 * - LE JOURNAL D'AUDIT ET LES TRACES DE CONNEXION ont une durée de douze mois
 *   (§7). Aucune purge ne les borne aujourd'hui — c'est une autre tâche, mais
 *   c'est la même promesse.
 */

const JOUR_MS = 24 * 60 * 60_000;

/* Une nuit, à une heure creuse, et AVANT l'ordonnanceur de 5 h : un compte
   effacé ne doit pas recevoir le rappel du matin. */
const CHAQUE_NUIT = "0 3 * * *";

/* Combien de comptes par passage. Borné pour que la nuit reste bornée : ce qui
   déborde attend le lendemain, sans que rien ne se perde — les comptes non
   traités gardent `erasedAt` nul et ressortent tels quels au passage suivant. */
const PAR_PASSAGE = 100;

/** Pourquoi ce compte est parti. Consigné au journal : les deux portes n'ont pas
 *  la même autorité, et un an plus tard c'est la question qu'on posera. */
type Porte = "delai_de_grace_echu" | "efface_par_administration";

@Injectable()
export class EffacementService {
  private readonly logger = new Logger("effacement");

  /* Une exécution à la fois, comme l'ordonnanceur. Deux passages concurrents ne
     casseraient rien — toutes les étapes sont idempotentes — mais ils
     travailleraient sur la même file pour rien. */
  private enCours = false;

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Cron(CHAQUE_NUIT)
  async passageNocturne(): Promise<void> {
    if (this.enCours) {
      this.logger.warn("passage précédent encore en cours, celui-ci est sauté");
      return;
    }
    this.enCours = true;
    try {
      await this.executer();
    } finally {
      this.enCours = false;
    }
  }

  /* Exposé à part du déclencheur, comme `OrdonnanceurService.executer` : c'est
     ce qui rend le passage éprouvable sans déplacer l'horloge, et rejouable à la
     main le jour où un incident aura fait manquer une nuit. */
  async executer(): Promise<void> {
    const delai = await delaiDeGraceEnJours(this.prisma);
    /* LA BORNE, et se tromper d'un signe est irréversible. Est échu ce qui a été
       DEMANDÉ il y a plus de `delai` jours — donc `deletionRequestedAt` doit
       être ANTÉRIEUR à ce point. Un compte demandé hier est encore restaurable
       et ne doit pas paraître ici. */
    const echu = new Date(Date.now() - delai * JOUR_MS);

    const comptes = await this.prisma.user.findMany({
      where: {
        // Le marqueur d'idempotence : ce qui est déjà vidé ne repasse jamais.
        erasedAt: null,
        /* L'EFFACEMENT ATTEND LE VERSEMENT (décision du 29/08).
         *
         * `effacerUn` supprime les méthodes de paiement. Après lui, il n'existe
         * plus aucune coordonnée où verser, et personne ne peut en ajouter
         * puisque le compte est vidé : la file des remboursements attendrait
         * pour toujours. Le compte reste donc en sursis tant que l'argent n'est
         * pas parti.
         *
         * `direction: refund` et non tout paiement en attente : une recharge qui
         * n'a pas abouti n'est pas une dette envers le titulaire, et bloquer
         * là-dessus retiendrait des comptes sans raison.
         *
         * L'exclusion porte sur les DEUX portes ci-dessous, l'effacement forcé
         * par l'administration compris : forcer ne doit pas faire disparaître
         * par inadvertance la coordonnée d'une dette. S'il faut vraiment
         * effacer, on règle le remboursement d'abord.
         */
        payments: { none: { direction: "refund", status: "pending" } },
        OR: [
          /* La porte de l'administration. Marquer `deleted` est réservé au rôle
             admin et exige un motif au journal (voir AdminUsersController) :
             c'est une décision prise en connaissance de cause, qui court-circuite
             le délai — et qui, jusqu'ici, n'effaçait rien du tout. */
          { status: "deleted" },
          /* La porte du titulaire. `not: null` n'est pas décoratif : sans lui,
             un compte marqué `pending_deletion` à la main, sans date, passerait
             le filtre `lte` par comparaison sur un nul — et partirait sans avoir
             jamais eu de délai. */
          { status: "pending_deletion", deletionRequestedAt: { not: null, lte: echu } },
        ],
        /* L'EFFACEMENT ATTEND LE VERSEMENT (décision du 29 août).
         *
         * Un compte dont un remboursement est encore dû ne part pas : son
         * numéro s'efface avec lui, et après ça il n'existe plus aucune
         * coordonnée où verser. La demande resterait en attente pour toujours,
         * et le titulaire — qui croit avoir supprimé son compte — n'aurait
         * jamais son argent.
         *
         * L'exclusion vaut pour les DEUX portes, effacement immédiat par
         * l'administration compris : forcer un effacement ne doit pas faire
         * disparaître la coordonnée d'une dette par inadvertance. Qui veut
         * vraiment effacer règle le remboursement d'abord. */
        payments: { none: { direction: "refund", status: "pending" } },
      },
      // Le plus ancien d'abord : c'est une file d'attente, pas un annuaire.
      orderBy: [{ deletionRequestedAt: "asc" }, { id: "asc" }],
      take: PAR_PASSAGE,
      select: { id: true, email: true, status: true },
    });

    for (const compte of comptes) {
      try {
        await this.effacerUn(
          compte.id,
          compte.email,
          compte.status === "deleted" ? "efface_par_administration" : "delai_de_grace_echu",
        );
      } catch (err: unknown) {
        /* Un compte qui tombe n'arrête pas les autres, et il ne se perd pas non
           plus : son `erasedAt` est resté nul, donc il ressort au passage
           suivant. On journalise l'IDENTIFIANT, jamais l'adresse — §2.3 :
           « l'identifiant du compte, jamais son adresse ». */
        this.logger.error(
          `effacement du compte ${compte.id} en échec : ${err instanceof Error ? err.message : "cause inconnue"}`,
        );
      }
    }
  }

  /**
   * Un compte, de bout en bout. L'ORDRE DES ÉTAPES EST LOAD-BEARING : voir la
   * note sur l'étape 6, qui doit passer AVANT que l'adresse ne soit remplacée.
   */
  private async effacerUn(id: string, email: string, porte: Porte): Promise<void> {
    // ── 1. Le carnet ────────────────────────────────────────────────────────
    /* §7 : « Fiches de proches, notes, souhaits : effacés à la suppression du
       compte du propriétaire. » Une seule suppression suffit : occasions,
       échéances, notes, attributs, souhaits et messages produits pendent tous du
       proche en CASCADE.
       Les notes DÉPOSÉES PAR UN TIERS via un lien de collecte partent avec —
       et c'est bien ce que §7 dit : elles vivent dans le carnet du propriétaire,
       qui disparaît. Ce qui appartient vraiment à un tiers, c'est l'inverse :
       une note que CE compte a écrite dans le carnet de QUELQU'UN D'AUTRE. Elle
       est traitée à l'étape 5, et surtout pas ici. */
    const { count: proches } = await this.prisma.person.deleteMany({ where: { userId: id } });

    // ── 2. Ce qui pend du compte sans passer par un proche ──────────────────
    /* Les trois premières lignes sont redondantes avec les cascades de l'étape 1
       — et elles restent, parce que la redondance est ce qui rend la REPRISE
       possible : sur un compte à moitié effacé dont les proches sont déjà
       partis, elles ramassent ce qu'une interruption aurait laissé. */
    await this.prisma.eventOccurrence.deleteMany({ where: { userId: id } });
    await this.prisma.generatedMessage.deleteMany({ where: { userId: id } });
    await this.prisma.notification.deleteMany({ where: { userId: id } });
    await this.prisma.notificationPreference.deleteMany({ where: { userId: id } });
    /* Les jetons de notification poussée. Les laisser ferait pousser un rappel
       sur le téléphone de quelqu'un dont le compte n'existe plus. */
    await this.prisma.device.deleteMany({ where: { userId: id } });
    /* Correspondance avec l'assistance et demandes d'export : du texte écrit par
       le titulaire, que §7 ne réserve nulle part. Rien ne les retient. */
    await this.prisma.supportRequest.deleteMany({ where: { userId: id } });
    await this.prisma.dataExportRequest.deleteMany({ where: { userId: id } });

    // ── 3. Les moyens d'entrer ──────────────────────────────────────────────
    const { count: sessions } = await this.prisma.refreshToken.deleteMany({ where: { userId: id } });
    /* Le rattachement Google/Apple. L'effacer n'est pas seulement une question
       de données : `@@unique([provider, providerUserId])` fait qu'une identité
       laissée là INTERDIRAIT à la personne de revenir un jour avec le même
       compte Google — un effacement qui bannit, sans le dire. */
    await this.prisma.federatedIdentity.deleteMany({ where: { userId: id } });
    /* §7 : « Codes à usage unique : quelques minutes, puis purgés. » Par
       l'adresse AUSSI, et pas seulement par le compte : un code de vérification
       d'adresse est écrit avant que le compte n'existe, `user_id` nul. */
    await this.prisma.otpCode.deleteMany({
      where: { OR: [{ userId: id }, { targetEmail: email }] },
    });

    // ── 4. Le moyen de payer ────────────────────────────────────────────────
    /* Le numéro mobile money, que §9.11 désigne comme la donnée à protéger le
       plus. `payment.payment_method_id` est en SetNull : le paiement survit à la
       disparition du moyen, comme la comptabilité l'exige, sans le numéro. */
    await this.prisma.paymentMethod.deleteMany({ where: { userId: id } });

    // ── 5. Ce qui appartient à un TIERS : le lien se rompt, la ligne reste ───
    /* Ces trois tables portent `author_user_id`, et à ce point de la procédure
       il ne reste QUE des lignes situées dans le carnet de quelqu'un d'autre —
       celles de ce compte sont parties à l'étape 1.
       Une note que ce compte a déposée chez un proche par un lien de collecte
       est la donnée de CE proche, pas la sienne : l'emporter effacerait le
       carnet d'un tiers qui n'a rien demandé. On coupe la signature, on laisse
       le contenu. C'est exactement ce que fait le SetNull du schéma quand la
       ligne `user` disparaît — sauf qu'ici elle ne disparaît pas, donc il faut
       le faire à la main. */
    await this.prisma.note.updateMany({ where: { authorUserId: id }, data: { authorUserId: null } });
    await this.prisma.event.updateMany({ where: { authorUserId: id }, data: { authorUserId: null } });
    await this.prisma.wishlistItem.updateMany({ where: { authorUserId: id }, data: { authorUserId: null } });
    /* Un avis sur le PRODUIT, pas sur la personne. Détaché du compte il
       n'identifie plus personne, et le supprimer ferait disparaître un signal
       qu'aucune obligation ne nous demande de perdre. Anonymisé, donc. */
    await this.prisma.feedback.updateMany({ where: { userId: id }, data: { userId: null } });

    // ── 6. Les traces de sécurité : déliées, jamais effacées ─────────────────
    /* §9.11, mot pour mot : « Les traces de sécurité survivent à la suppression
       sous une forme anonymisée : leur lien vers le compte est rompu, la ligne
       demeure. »
       DeviceSignup EN PARTICULIER : c'est elle qui tient le plafond de comptes
       par appareil, et le plafond porte sur le seul `deviceId`. L'effacer
       ouvrirait la porte que §9.11 nomme — créer puis supprimer des comptes pour
       en recréer sans limite. On casse `userId`, on garde `deviceId` et l'IP. */
    const { count: appareils } = await this.prisma.deviceSignup.updateMany({
      where: { userId: id },
      data: { userId: null },
    });
    /* Les tentatives de connexion. `attemptedEmail` porte l'adresse EN CLAIR :
       rompre le seul `userId` laisserait l'identifiant au milieu de la trace, et
       l'anonymisation serait de façade. On efface les deux — le résultat, l'IP,
       la méthode et l'heure restent, c'est-à-dire tout ce qui sert à documenter
       un incident.
       Le critère porte sur l'adresse AUSSI : un échec de connexion sur une
       adresse inconnue s'écrit sans `user_id`.

       CETTE ÉTAPE DOIT PASSER AVANT L'ÉTAPE 7, et l'ordre n'est pas une
       préférence. L'étape 7 remplace l'adresse par un substitut ; si un passage
       s'arrêtait entre les deux, la reprise relirait le SUBSTITUT et ne
       retrouverait plus jamais ces lignes-ci. L'adresse d'origine resterait au
       journal pour toujours, sans que rien ne le signale. */
    await this.prisma.loginActivity.updateMany({
      where: { OR: [{ userId: id }, { attemptedEmail: email }] },
      data: { userId: null, attemptedEmail: null },
    });

    // ── 7. Le compte lui-même : vidé sur place, et le marqueur en dernier ────
    /* La trace et le marqueur dans la MÊME transaction. Séparés, une panne entre
       les deux laisserait soit un compte effacé dont rien ne dit qu'il l'a été
       (et le passage suivant le referait, en écrivant une seconde trace), soit
       une trace annonçant un effacement qui n'a pas eu lieu. */
    await this.prisma.$transaction([
      /* `actorType: "user"`, et non « admin » : la trace se range sous le compte
         qu'elle concerne, ce qui la rend lisible depuis sa fiche par les deux
         index du journal. Le MOTIF de la décision, lui, est déjà consigné —
         `user_status_update` porte celui de l'administrateur, et la contrainte
         `audit_log_motif_obligatoire` ne l'exige que de lui. */
      this.prisma.auditLog.create({
        data: {
          actorType: "user",
          actorId: id,
          action: "account_erased",
          targetType: "user",
          targetId: id,
          // Ce que le geste a emporté. « il a été effacé » ne se relit pas ;
          // « il portait quatre proches » se relit.
          metadata: { porte, proches, sessions, appareilsDelies: appareils },
        },
      }),
      this.prisma.user.update({
        where: { id },
        data: {
          /* L'adresse et le pseudo doivent rester UNIQUES : deux comptes effacés
             ne peuvent pas porter la même. L'identifiant les distingue, et il ne
             révèle rien de plus que la clé étrangère que la comptabilité garde
             de toute façon.
             `.invalid` est le domaine réservé par la RFC 2606 : aucun courrier
             ne peut y aboutir, aucune résolution ne peut réussir. Un domaine
             qui nous appartiendrait laisserait la porte ouverte à un envoi. */
          email: `supprime+${id}@lehno.invalid`,
          emailVerified: false,
          username: `supprime-${id}`,
          displayName: null,
          avatarUrl: null,
          /* Un code neuf, pas le sien. Le code d'origine a circulé dans des
             messages : le laisser vivant rattacherait un nouvel inscrit à un
             compte effacé. Les parrainages déjà noués ne bougent pas — `Referral`
             en RECOPIE le code (`codeUsed`), justement pour cela. */
          referralCode: randomBytes(8).toString("hex"),
          /* Un texte libre écrit par le titulaire, dont on ne sait pas ce qu'il
             contient. Le motif de l'administration, lui, vit au journal. */
          deletionReason: null,
          /* Prises ensemble — fuseau, heure d'envoi, langue, thème — les
             préférences dessinent quelqu'un. Ramenées à leur défaut, elles ne
             disent plus rien, et rien ne les lira jamais plus. */
          gender: "unspecified",
          uiLanguage: "fr",
          theme: "system",
          timezone: "UTC",
          sendHour: 9,
          digestFrequency: "monthly",
          reminderLeadDays: null,
          activationEmailsOptedOut: false,
          /* `acceptedTermsAt` et `acceptedTermsVersion` NE SONT PAS TOUCHÉS, et
             c'est délibéré : §13 promet que « chaque acceptation est horodatée et
             conservée », et ces deux colonnes disent sous quel contrat les
             paiements qu'on garde ont été faits. Une pièce comptable dont on
             aurait effacé les conditions ne vaut plus grand-chose. */
          status: "deleted",
          erasedAt: new Date(),
        },
      }),
    ]);
  }
}
