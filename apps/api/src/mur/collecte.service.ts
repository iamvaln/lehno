import { Inject, Injectable } from "@nestjs/common";
import type {
  CollectionLink, CreateCollectionLinkInput, PublicCollectForm,
  CollectSubmitInput, PublicSubmissions,
} from "@lehno/contracts";
import { PrismaService } from "../prisma/prisma.service.js";
import { TenantRepository } from "../tenancy/tenant.repository.js";
import { AppError } from "../common/errors.js";
import { nouveauJeton, SurfacePubliqueService } from "./jetons.js";

// Ce que la base rend pour un lien, réduit à ce que le contrat porte.
type LigneLien = {
  id: string; type: string; token: string; personId: string | null;
  isActive: boolean; createdAt: Date;
};

function rendre(l: LigneLien): CollectionLink {
  return {
    id: l.id,
    type: l.type as CollectionLink["type"],
    token: l.token,
    personId: l.personId,
    isActive: l.isActive,
    createdAt: l.createdAt.toISOString(),
  };
}

const ABSENT = (): AppError => new AppError("not_found", "resource not found");

@Injectable()
export class CollecteService {
  // @Inject explicites : voir WishService, même contrainte esbuild/vitest.
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TenantRepository) private readonly depot: TenantRepository,
    @Inject(SurfacePubliqueService) private readonly surface: SurfacePubliqueService,
  ) {}

  // ── L'espace privé ────────────────────────────────────────────────────────

  async list(userId: string): Promise<CollectionLink[]> {
    const lignes = await this.prisma.collectionLink.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    return lignes.map(rendre);
  }

  /* Créer, ou ROUVRIR le lien qui existait déjà.
   *
   * §3.20 dit « lien révoqué (réactivable) », et c'est plus qu'une commodité :
   * le jeton circule déjà chez le proche, souvent en favori dans son
   * navigateur. En frapper un second le laisserait devant une page morte sans
   * qu'il sache pourquoi, et couperait ses contributions passées du nouveau
   * lien — or c'est par ce jeton qu'il relit le sort de ses souhaits.
   *
   * Un lien nominatif par FICHE, un lien public par COMPTE. Un second lien
   * public n'apporte rien — il ne vise personne — et ferait deux adresses à
   * révoquer, dont une qu'on oublierait.
   */
  async create(userId: string, input: CreateCollectionLinkInput): Promise<CollectionLink> {
    // findOrThrow AVANT toute écriture : rattacher un lien à la fiche d'un
    // autre doit échouer en 404, pas en 403.
    if (input.type === "nominatif") await this.depot.persons(userId).findOrThrow(input.personId!);

    const existant = await this.prisma.collectionLink.findFirst({
      where: {
        userId,
        type: input.type,
        personId: input.type === "nominatif" ? input.personId! : null,
      },
      orderBy: { createdAt: "asc" },
    });
    if (existant) {
      const rouvert = await this.prisma.collectionLink.update({
        where: { id: existant.id },
        data: { isActive: true },
      });
      return rendre(rouvert);
    }

    const ligne = await this.prisma.collectionLink.create({
      data: {
        userId,
        type: input.type,
        token: nouveauJeton(),
        personId: input.type === "nominatif" ? input.personId! : null,
      },
    });
    return rendre(ligne);
  }

  /* Révoquer, jamais supprimer. La ligne porte les contributions déjà reçues :
     l'effacer emporterait ce que des gens ont écrit, et le propriétaire ne
     saurait plus d'où venait ce qu'il a validé. */
  async revoke(userId: string, id: string): Promise<void> {
    const { count } = await this.prisma.collectionLink.updateMany({
      where: { id, userId },
      data: { isActive: false },
    });
    if (count === 0) throw ABSENT();
  }

  // ── La surface publique ───────────────────────────────────────────────────

  /* Résoudre un jeton, et DIRE CE QUI NE VA PAS sans jamais en dire trop.
   *
   * Trois issues, et l'écart entre elles est le cœur de la surface :
   * — jeton inconnu → 404. Dire « révoqué » sur un jeton tiré au hasard ferait
   *   de ce chemin un oracle : on saurait qu'un lien existe en essayant.
   * — jeton connu mais révoqué → 410. Le visiteur a reçu ce lien de quelqu'un ;
   *   « page introuvable » lui ferait croire qu'il a mal recopié l'adresse.
   * — compte suspendu ou en suppression → 404, comme s'il n'avait jamais
   *   existé. Une suspension qui laisse la collecte ouverte n'est pas une
   *   suspension.
   */
  private async resoudre(token: string) {
    const lien = await this.prisma.collectionLink.findUnique({
      where: { token },
      include: {
        user: { select: { id: true, status: true, displayName: true, username: true, wall: { select: { isEnabled: true } } } },
        person: { select: { id: true, displayName: true, callingName: true, birthDate: true } },
      },
    });
    if (!lien) throw ABSENT();
    if (lien.user.status !== "active") throw ABSENT();
    if (!lien.isActive) throw new AppError("link_revoked", "this link is no longer active");
    return lien;
  }

  async formulaire(token: string): Promise<PublicCollectForm> {
    const lien = await this.resoudre(token);
    const nominatif = lien.type === "nominatif";
    return {
      type: lien.type as PublicCollectForm["type"],
      ownerDisplayName: lien.user.displayName ?? lien.user.username,
      /* Rien de la fiche sur un lien PUBLIC : celui-ci se partage au monde, et
         y servir un nom ou une date exposerait une fiche à quiconque relaie
         l'adresse. Le formulaire public demande, il ne montre pas. */
      personDisplayName: nominatif ? (lien.person?.callingName ?? lien.person?.displayName ?? null) : null,
      birthDate: nominatif ? (lien.person?.birthDate?.toISOString().slice(0, 10) ?? null) : null,
      // Le CTA « visiter le mur », seulement si le Mur est publié : proposer un
      // lien vers une page dépubliée apprendrait qu'elle existe.
      ownerWallUsername: lien.user.wall?.isEnabled ? lien.user.username : null,
    };
  }

  async soumettre(token: string, input: CollectSubmitInput, ip?: string): Promise<{ submitted: true }> {
    // Les filtres à robots AVANT la résolution du jeton : un robot qui remplit
    // le leurre n'a pas à savoir si le lien existe.
    this.surface.refuserLesRobots(input);
    const lien = await this.resoudre(token);
    await this.surface.plafonner("collect", token, ip);

    /* Une seule transaction pour la contribution et ses souhaits : une
       `Submission` sans ses lignes serait une contribution vide dans la file
       de validation, et le répondant croirait avoir envoyé ce qui s'est perdu. */
    await this.prisma.submission.create({
      data: {
        userId: lien.userId,
        collectionLinkId: lien.id,
        /* Nom et « on se connaît d'où » ne sont demandés que par le formulaire
           public. S'ils arrivent malgré tout sur un nominatif, on les GARDE
           plutôt que de les jeter : quelqu'un qui a pris la peine de se nommer
           ne doit pas voir son nom disparaître sans explication. */
        submitterName: input.submitterName ?? null,
        relationHint: input.relationHint ?? null,
        submitterEmail: input.submitterEmail ?? null,
        /* Le pseudo n'est PAS résolu ici. Le résoudre en `author_user_id` à
           l'arrivée ferait d'un inconnu l'auteur d'une contribution qu'il n'a
           pas écrite : le champ est auto-déclaré sur un formulaire sans
           connexion. Il se confirme à la validation, sous les yeux du
           propriétaire. */
        submitterUsername: input.submitterUsername ?? null,
        birthDate: input.birthDate ? new Date(`${input.birthDate}T00:00:00Z`) : null,
        personalNote: input.personalNote ?? null,
        wishes: {
          create: (input.wishes ?? []).map((s) => ({
            label: s.label,
            link: s.link ?? null,
            price: s.price ?? null,
            currency: s.currency ?? null,
          })),
        },
      },
    });

    /* Muet sur ce qui s'est passé ensuite : « c'est transmis », rien d'autre.
       Rendre l'identifiant de la contribution en ferait une clé à essayer, et
       le répondant n'en a aucun usage — il relit par son jeton. */
    return { submitted: true };
  }

  /* Ce que CE répondant a déjà envoyé — sur un lien NOMINATIF seulement.
   *
   * Un lien public est partagé au monde : y rendre les contributions ferait
   * lire à n'importe quel visiteur le nom, le mot et les souhaits de tous les
   * autres. Le jeton d'un nominatif, lui, ne désigne qu'une personne, et c'est
   * ce qui rend la relecture légitime.
   *
   * 404 et non 403 sur un lien public : le chemin n'existe pas pour ce
   * lien-là, et un refus explicite apprendrait qu'il existe ailleurs.
   */
  async relire(token: string): Promise<PublicSubmissions> {
    const lien = await this.resoudre(token);
    if (lien.type !== "nominatif") throw ABSENT();

    const lignes = await this.prisma.submission.findMany({
      where: { collectionLinkId: lien.id },
      orderBy: { createdAt: "desc" },
      select: {
        createdAt: true, status: true, birthDate: true, personalNote: true,
        wishes: { select: { label: true, reviewStatus: true }, orderBy: { createdAt: "asc" } },
      },
    });

    return {
      submissions: lignes.map((s) => ({
        createdAt: s.createdAt.toISOString(),
        status: s.status as PublicSubmissions["submissions"][number]["status"],
        birthDate: s.birthDate?.toISOString().slice(0, 10) ?? null,
        personalNote: s.personalNote,
        /* Ni l'adresse ni le pseudo qu'il avait donnés : il les a écrits, il
           les connaît, et les rendre ferait de ce chemin un moyen de les LIRE
           pour qui détiendrait le lien — un lien qui, lui, peut être transféré. */
        wishes: s.wishes.map((w) => ({
          label: w.label,
          reviewStatus: w.reviewStatus as "pending" | "retained" | "discarded",
        })),
      })),
    };
  }
}
