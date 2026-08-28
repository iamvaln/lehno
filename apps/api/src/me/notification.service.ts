import { Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type {
  ListNotificationsQuery, MarkNotificationsReadInput,
  Notification, NotificationsPage, NotificationsReadResult,
} from "@lehno/contracts";
import { PrismaService } from "../prisma/prisma.service.js";
import { TenantRepository } from "../tenancy/tenant.repository.js";
import { AppError } from "../common/errors.js";

// Combien d'entrées une page rend par défaut. Le centre se parcourt au pouce :
// assez pour remplir un écran et son élan, pas assez pour qu'une file laissée
// sans lecture pendant des mois arrive d'un bloc.
const PAGE_DEFAUT = 20;

/* CE QUE LE CENTRE CONTIENT — le prédicat, en un seul endroit.
 *
 * Deux conditions, et chacune répare une manière différente de mentir à
 * l'utilisateur.
 *
 * 1. `channel: "in_app"`. La table `Notification` sert de REGISTRE D'ENVOIS
 *    autant que de file du centre : la programmation pose une ligne PAR CANAL
 *    pour un même fait (voir le `dedupeKey` suffixé par le canal). Rendre la
 *    table telle quelle afficherait le même rappel deux ou trois fois — une
 *    fois pour le centre, une fois pour le courrier parti, une fois pour la
 *    poussée. Le courrier et la poussée sont des ENVOIS ; ils n'ont jamais eu
 *    d'entrée dans le centre.
 *
 * 2. L'échéance. `scheduled_for` est la date à laquelle la notification est
 *    DUE, pas celle où on l'a écrite : la programmation garnit la file un mois
 *    d'avance. Sans cette borne, le centre annoncerait « l'anniversaire de
 *    Célarine est dans sept jours » cinq semaines à l'avance, et la pastille
 *    de l'accueil compterait comme non lu ce que personne ne peut encore lire.
 *    Nul vaut « tout de suite » — c'est ce que posent les relances, et c'est
 *    déjà la convention d'EnvoiService.
 *
 * Ce prédicat est partagé avec HomeService, qui en tire `unreadNotifications`.
 * Recopié là-bas, il aurait divergé au premier ajout : c'est exactement ce qui
 * s'était produit — la pastille comptait les lignes `email` et `push`, donc
 * elle annonçait trois éléments à un centre qui n'en montrait qu'un.
 */
export function perimetreDuCentre(maintenant: Date = new Date()): Prisma.NotificationWhereInput {
  return {
    channel: "in_app",
    OR: [{ scheduledFor: null }, { scheduledFor: { lte: maintenant } }],
  };
}

// Ce qui n'a pas encore été lu, dans ce périmètre. `readAt` est nullable et
// indexé par [userId, readAt] : c'est le décompte, pas une lecture déguisée.
export function nonLuesDuCentre(maintenant: Date = new Date()): Prisma.NotificationWhereInput {
  return { ...perimetreDuCentre(maintenant), readAt: null };
}

type Ligne = {
  id: string; type: string; titleKey: string; bodyParams: unknown;
  targetRoute: string | null; personId: string | null; eventOccurrenceId: string | null;
  readAt: Date | null; scheduledFor: Date | null; createdAt: Date;
};

@Injectable()
export class NotificationService {
  // @Inject explicite : voir OccurrenceService/HomeService, même contrainte
  // esbuild/vitest — design:paramtypes n'est pas émis, un paramètre typé sans
  // jeton explicite se résoudrait à `undefined` chez Nest.
  constructor(
    @Inject(TenantRepository) private readonly depot: TenantRepository,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async list(userId: string, query: ListNotificationsQuery): Promise<NotificationsPage> {
    const maintenant = new Date();
    const limite = query.limit ?? PAGE_DEFAUT;

    /* On demande UNE ligne de plus que la page. C'est ce qui permet de dire
       « il en reste » sans compter la file entière, et sans rendre un curseur
       qui mènerait à une page vide — le client afficherait alors un « voir
       plus » qui ne montre rien. */
    const lignes = (await this.depot.notifications(userId).findMany(perimetreDuCentre(maintenant), {
      /* L'ordre est celui de l'ÉCHÉANCE, pas de la création, et c'est le piège
         principal de ce chemin. Un passage de programmation écrit d'un coup les
         rappels de toutes les échéances du mois : leurs `created_at` sont
         identiques à la seconde près, et leur ordre relatif est celui dans
         lequel la base a rendu les échéances. Trier là-dessus donnerait une
         liste rangée par un détail interne, où un rappel d'hier peut passer
         devant celui de ce matin.

         `id` en second : sans départage stable, deux lignes de même échéance
         peuvent s'échanger entre deux pages, et le curseur perd ou répète
         l'une des deux. */
      orderBy: [{ scheduledFor: "desc" }, { id: "desc" }],
      take: limite + 1,
      /* `skip: 1` : le curseur DÉSIGNE la dernière ligne rendue, il ne la
         remplace pas. Sans lui, chaque page recommencerait par l'entrée que la
         précédente terminait. */
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    })) as unknown as Ligne[];

    const page = lignes.slice(0, limite);

    return {
      items: page.map((l) => this.rendre(l)),
      nextCursor: lignes.length > limite ? (page.at(-1)?.id ?? null) : null,
      unreadCount: await this.compterNonLues(userId, maintenant),
    };
  }

  async marquerLues(userId: string, entree: MarkNotificationsReadInput): Promise<NotificationsReadResult> {
    const maintenant = new Date();
    const portee = this.depot.notifications(userId);

    let cible: Prisma.NotificationWhereInput = perimetreDuCentre(maintenant);

    if ("ids" in entree) {
      /* Les doublons tombent AVANT le contrôle d'appartenance : le même
         identifiant envoyé deux fois est une maladresse de client, pas une
         entrée introuvable, et le comparatif de longueur ci-dessous le
         prendrait pour telle. */
      const ids = [...new Set(entree.ids)];

      /* 404, jamais 403, et jamais un silence. On vérifie que CHAQUE
         identifiant existe DANS LE CENTRE de ce compte — la notification d'un
         autre, comme la ligne `email` que le centre n'a jamais rendue, n'existe
         pas pour le demandeur.

         Le contrôle ne peut pas se déduire du nombre de lignes mises à jour :
         une notification déjà lue donne zéro elle aussi, et confondre les deux
         ferait échouer le rejeu — celui-là même que l'idempotence promet. */
      const connues = await portee.findMany({ AND: [perimetreDuCentre(maintenant), { id: { in: ids } }] });
      if (connues.length !== ids.length) {
        throw new AppError("not_found", "resource not found");
      }
      cible = { AND: [perimetreDuCentre(maintenant), { id: { in: ids } }] };
    }

    /* On POSE une date là où il n'y en a pas encore. Le `readAt: null` n'est
       pas une optimisation : sans lui, un second appel réécrirait l'horodatage
       et une notification lue mardi se relirait « lue vendredi ». La date de
       première lecture est le fait ; la dernière ouverture n'en est pas un.

       `status` reste où il est, à dessein. Il décrit l'ACHEMINEMENT
       (`pending` → `sent` / `failed`) ; la lecture, elle, se lit dans `readAt`,
       qui porte l'index [userId, readAt] dont vivent la pastille et cette
       liste. Écrire les deux créerait deux vérités pour un seul fait, qu'une
       panne entre les deux écritures suffirait à séparer. */
    await portee.updateWhere({ AND: [cible, { readAt: null }] }, { readAt: maintenant });

    return { unreadCount: await this.compterNonLues(userId, maintenant) };
  }

  // Le décompte de la pastille. Public parce que HomeService le sert aussi :
  // une cloche qui annonce trois éléments au-dessus d'un centre qui en montre
  // un apprend à ne plus croire la cloche.
  compterNonLues(userId: string, maintenant: Date = new Date()): Promise<number> {
    return this.prisma.notification.count({ where: { userId, ...nonLuesDuCentre(maintenant) } });
  }

  private rendre(l: Ligne): Notification {
    return {
      id: l.id,
      type: l.type as Notification["type"],
      titleKey: l.titleKey,
      /* `bodyParams` est du JSON libre en base — un `null` de colonne et un
         `null` JSON s'y confondent. On le rend tel quel, sans réparer : le
         contrat n'accepte que des chaînes et des nombres, et fabriquer ici une
         valeur de repli masquerait un producteur qui pose autre chose. */
      bodyParams: (l.bodyParams ?? null) as Notification["bodyParams"],
      targetRoute: l.targetRoute,
      personId: l.personId,
      eventOccurrenceId: l.eventOccurrenceId,
      readAt: l.readAt?.toISOString() ?? null,
      // Voir la note du contrat : l'entrée est datée de son ÉCHÉANCE, pas de
      // l'instant où la programmation l'a écrite, un mois plus tôt.
      notifiedAt: (l.scheduledFor ?? l.createdAt).toISOString(),
    };
  }
}
