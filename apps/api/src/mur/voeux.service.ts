import { Inject, Injectable } from "@nestjs/common";
import type {
  ReceivedWish, ReceivedWishDecisionInput,
  PublicWishForm, SubmitWishInput,
} from "@lehno/contracts";
import { PrismaService } from "../prisma/prisma.service.js";
import { AppError } from "../common/errors.js";
import { ajouterJours } from "../me/calendrier.js";
import { SurfacePubliqueService } from "./jetons.js";

const ABSENT = (): AppError => new AppError("not_found", "resource not found");

const LEAD_PAR_DEFAUT = 7;
const TRAIL_PAR_DEFAUT = 30;

@Injectable()
export class VoeuxService {
  // @Inject explicites : voir WishService, même contrainte esbuild/vitest.
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SurfacePubliqueService) private readonly surface: SurfacePubliqueService,
  ) {}

  private aujourdhui(): string {
    return new Date().toISOString().slice(0, 10);
  }

  // ── L'espace privé ────────────────────────────────────────────────────────

  async list(userId: string): Promise<ReceivedWish[]> {
    const lignes = await this.prisma.receivedWish.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    return lignes.map((v) => ({
      id: v.id,
      occurrenceId: v.eventOccurrenceId,
      authorName: v.authorName,
      content: v.content,
      status: v.status as ReceivedWish["status"],
      createdAt: v.createdAt.toISOString(),
    }));
  }

  /* Approuver ou rejeter — et une seule fois.
   *
   * Sans la garde sur `pending`, un vœu rejeté pourrait être réapprouvé plus
   * tard par un client qui rejoue son appel : la modération ne protégerait
   * plus, elle enregistrerait seulement le dernier avis exprimé.
   */
  async decide(userId: string, id: string, decision: ReceivedWishDecisionInput): Promise<ReceivedWish> {
    const { count } = await this.prisma.receivedWish.updateMany({
      where: { id, userId, status: "pending" },
      data: { status: decision.decision },
    });
    if (count === 0) {
      // Distinguer « pas à vous » de « déjà tranché » demanderait une seconde
      // lecture. On la fait : le premier doit rester un 404 muet, le second
      // doit dire au client que son geste a déjà porté.
      const existe = await this.prisma.receivedWish.findFirst({
        where: { id, userId }, select: { id: true },
      });
      if (!existe) throw ABSENT();
      throw new AppError("conflict", "this wish has already been reviewed");
    }
    const [rendu] = await this.list(userId).then((tous) => tous.filter((v) => v.id === id));
    return rendu!;
  }

  // ── La surface publique ───────────────────────────────────────────────────

  /* Même échelle de refus que la collecte : jeton inconnu → 404, jeton révoqué
   * → 410, compte suspendu → 404. Voir CollecteService.resoudre pour le
   * raisonnement — il vaut mot pour mot ici.
   */
  private async resoudre(token: string) {
    const lien = await this.prisma.wishCollectionLink.findUnique({
      where: { token },
      include: {
        user: { select: { id: true, status: true, displayName: true, username: true } },
        occurrence: { select: { id: true, occurrenceDate: true } },
      },
    });
    if (!lien) throw ABSENT();
    if (lien.user.status !== "active") throw ABSENT();
    if (!lien.isActive) throw new AppError("link_revoked", "this link is no longer active");
    return lien;
  }

  private async delais(): Promise<{ lead: number; trail: number }> {
    const parametres = await this.prisma.systemParameter.findMany({
      where: { key: { in: ["wish_window_lead_days", "wish_window_trail_days"] } },
    });
    const jours = (cle: string, defaut: number): number => {
      const ligne = parametres.find((p) => p.key === cle);
      const valeur = ligne ? Number(ligne.value) : NaN;
      return Number.isFinite(valeur) ? valeur : defaut;
    };
    return {
      lead: jours("wish_window_lead_days", LEAD_PAR_DEFAUT),
      trail: jours("wish_window_trail_days", TRAIL_PAR_DEFAUT),
    };
  }

  /* La page S'OUVRE même hors fenêtre, et rend alors les bornes.
   *
   * §3.9 demande « les vœux pour cet anniversaire ne sont pas ouverts en ce
   * moment (± indiquer quand) » : une lecture qui refuse ne peut pas dire quand
   * revenir, et le visiteur repart sans savoir s'il doit réessayer. C'est le
   * DÉPÔT qui refuse, pas la lecture.
   */
  async formulaire(token: string): Promise<PublicWishForm> {
    const lien = await this.resoudre(token);
    const { lead, trail } = await this.delais();
    const date = lien.occurrence.occurrenceDate.toISOString().slice(0, 10);
    const ouvreLe = ajouterJours(date, -lead);
    const fermeLe = ajouterJours(date, trail);
    const aujourdhui = this.aujourdhui();
    return {
      recipientDisplayName: lien.user.displayName ?? lien.user.username,
      occurrenceDate: date,
      windowOpensOn: ouvreLe,
      windowClosesOn: fermeLe,
      isOpen: aujourdhui >= ouvreLe && aujourdhui <= fermeLe,
    };
  }

  async deposer(token: string, input: SubmitWishInput, ip?: string): Promise<{ submitted: true }> {
    // Les filtres à robots AVANT la résolution : un robot qui remplit le leurre
    // n'a pas à savoir si le lien existe, ni si la fenêtre est ouverte.
    this.surface.refuserLesRobots(input);
    const lien = await this.resoudre(token);
    const fenetre = await this.formulaire(token);
    if (!fenetre.isOpen) {
      /* 422 avec les dates : « refus expliqué, jamais un formulaire qui échoue
         en silence » (§6). Le message tardif est perdu de toute façon — au
         moins la page peut dire pourquoi. */
      throw new AppError("wish_window_closed", "the wish window is closed", {
        opensOn: fenetre.windowOpensOn,
        closesOn: fenetre.windowClosesOn,
      });
    }
    await this.surface.plafonner("wishes", token, ip);

    await this.prisma.receivedWish.create({
      data: {
        eventOccurrenceId: lien.eventOccurrenceId,
        userId: lien.userId,
        wishCollectionLinkId: lien.id,
        /* `authorUserId` reste NUL : la page est publique, personne n'y est
           authentifié, et rattacher un vœu à un compte sur la foi d'un nom
           tapé ferait signer quelqu'un qui n'a rien écrit. */
        authorName: input.authorName ?? null,
        content: input.content,
      },
    });

    // « Ton message est transmis » — et rien d'autre. Le vœu arrive `pending` :
    // il n'existe pour le destinataire qu'après sa modération, et jamais sur la
    // page publique. Le Mur n'a pas de livre d'or.
    return { submitted: true };
  }
}
