import { Controller, Get, Inject, Injectable, Query, UseGuards } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import type {
  ModeTransaction, PeriodeTransactions, SensTransaction, StatsTransactions,
} from "@lehno/contracts";
import { PrismaService } from "../prisma/prisma.service.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { AdminGuard } from "./admin.guard.js";
import { RoleGuard } from "./role.guard.js";

const JOURS: Record<string, number> = { "7j": 7, "30j": 30, "90j": 90 };

export const requeteStatsSchema = z.object({
  periode: z.enum(["7j", "30j", "90j"]).optional(),
  sens: z.enum(["tous", "depot", "retrait"]).optional(),
  mode: z.enum(["tous", "auto", "manuel"]).optional(),
}).strict();

/* Les trois axes, typés par le CONTRAT plutôt que dérivés du schéma de requête :
   `Required<>` sur des champs facultatifs garde `undefined` dans les valeurs, et
   la réponse cesse alors de correspondre à ce qu'elle promet. */
type Coupe = {
  periode: PeriodeTransactions;
  sens: SensTransaction;
  mode: ModeTransaction;
};
type LigneTete = {
  tentatives: number; aboutis: number;
  encaisse: number | null; frais: number | null; median: number | null;
};
type LigneJour = { jour: string; encaisse: number; echoue: number };
type LigneGroupe = { cle: string; tentatives: number; aboutis: number };

/**
 * Ce qui est encaissé, ce que ça coûte, ce qui n'aboutit pas.
 *
 * **Trois axes, et la réponse dit lequel elle rend.** Période, sens, mode : le
 * graphe et les quatre chiffres suivent la même coupe. Une carte figée à côté
 * d'un graphe qui bouge ment dès le premier changement de période — et c'est
 * précisément le défaut que le lot de conception signalait.
 */
@Injectable()
export class PaymentStatsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async statistiques(requete: z.infer<typeof requeteStatsSchema>): Promise<StatsTransactions> {
    const coupe: Coupe = {
      periode: requete.periode ?? "30j",
      sens: requete.sens ?? "tous",
      mode: requete.mode ?? "tous",
    };
    const depuis = new Date(Date.now() - (JOURS[coupe.periode] ?? 30) * 24 * 60 * 60_000);
    const filtre = this.filtre(coupe, depuis);

    const [tete, jours, parMoyen, parPays] = await Promise.all([
      this.tete(filtre),
      this.jours(filtre),
      this.parGroupe(filtre, Prisma.sql`c.kind::text`),
      this.parGroupe(filtre, Prisma.sql`c.country`),
    ]);

    return {
      ...coupe,
      tentatives: tete?.tentatives ?? 0,
      aboutis: tete?.aboutis ?? 0,
      encaisse: Number(tete?.encaisse ?? 0),
      frais: Number(tete?.frais ?? 0),
      // Nul, jamais zéro : « aucun paiement n'a abouti » et « le paiement
      // médian vaut zéro franc » sont deux nouvelles opposées.
      median: tete?.median === null || tete?.median === undefined ? null : Number(tete.median),
      jours: jours.map((j) => ({
        jour: j.jour, encaisse: Number(j.encaisse), echoue: Number(j.echoue),
      })),
      parMoyen,
      parPays,
    };
  }

  /**
   * La coupe, écrite UNE fois et partagée par les quatre requêtes.
   *
   * Quatre `where` recopiés divergeraient au premier axe ajouté, et le graphe
   * finirait par montrer autre chose que ses cartes — sans que rien ne le dise.
   */
  private filtre(coupe: Coupe, depuis: Date): Prisma.Sql {
    const sens = coupe.sens === "depot"
      ? Prisma.sql`AND p.direction = 'charge'`
      : coupe.sens === "retrait"
        ? Prisma.sql`AND p.direction = 'refund'`
        : Prisma.empty;

    /* « manuel » couvre LES DEUX voies humaines : au lancement c'est la seule
       façon de recharger, et n'en montrer qu'une moitié fausserait le compte. */
    const mode = coupe.mode === "auto"
      ? Prisma.sql`AND p.mode = 'provider'`
      : coupe.mode === "manuel"
        ? Prisma.sql`AND p.mode IN ('semi_manual', 'manual')`
        : Prisma.empty;

    return Prisma.sql`p.created_at >= ${depuis} ${sens} ${mode}`;
  }

  private async tete(filtre: Prisma.Sql): Promise<LigneTete | undefined> {
    const [ligne] = await this.prisma.$queryRaw<LigneTete[]>`
      SELECT count(*)::int AS "tentatives",
             count(*) FILTER (WHERE p.status = 'succeeded')::int AS "aboutis",
             coalesce(sum(p.amount) FILTER (WHERE p.status = 'succeeded'), 0) AS "encaisse",
             coalesce(sum(p.fee_amount) FILTER (WHERE p.status = 'succeeded'), 0) AS "frais",
             -- La MÉDIANE, pas la moyenne : un versement exceptionnel tirerait
             -- la moyenne et ferait croire à un panier qui n'existe pour
             -- personne. Nulle quand rien n'a abouti.
             percentile_cont(0.5) WITHIN GROUP (
               ORDER BY p.amount) FILTER (WHERE p.status = 'succeeded') AS "median"
      FROM payment p
      WHERE ${filtre}`;
    return ligne;
  }

  private jours(filtre: Prisma.Sql): Promise<LigneJour[]> {
    /* Encaissé et échoué ne s'additionnent pas : ce sont deux mesures du même
       jour, pas les parts d'un total. Les fondre en un solde cacherait
       exactement ce qu'on vient regarder. */
    return this.prisma.$queryRaw<LigneJour[]>`
      SELECT to_char(date_trunc('day', p.created_at), 'YYYY-MM-DD') AS "jour",
             coalesce(sum(p.amount) FILTER (WHERE p.status = 'succeeded'), 0) AS "encaisse",
             coalesce(sum(p.amount) FILTER (WHERE p.status IN ('failed', 'expired')), 0) AS "echoue"
      FROM payment p
      WHERE ${filtre}
      GROUP BY 1
      ORDER BY 1`;
  }

  /**
   * L'aboutissement par groupe — le moyen de paiement, le pays.
   *
   * Les deux se lisent sur le CANAL, seul porteur de l'opérateur et du pays.
   * Un paiement sans canal — une écriture d'administration — n'a ni l'un ni
   * l'autre : il sort du classement plutôt que d'y figurer sous une clé vide,
   * qui se lirait comme un moyen de paiement à part.
   */
  private parGroupe(filtre: Prisma.Sql, cle: Prisma.Sql): Promise<LigneGroupe[]> {
    return this.prisma.$queryRaw<LigneGroupe[]>`
      SELECT ${cle} AS "cle",
             count(*)::int AS "tentatives",
             count(*) FILTER (WHERE p.status = 'succeeded')::int AS "aboutis"
      FROM payment p
      JOIN payment_channel c ON c.id = p.payment_channel_id
      WHERE ${filtre}
      GROUP BY 1
      ORDER BY 1`;
  }
}

/* `admin/payment-stats` et NON `admin/payments/stats`.
 *
 * `PaymentListsController` déclare `admin/payments/:id` : le second chemin y
 * tombe, et le serveur cherche un paiement dont l'identifiant serait « stats ».
 * On pourrait s'en tirer en enregistrant ce contrôleur avant l'autre — mais un
 * ordre d'enregistrement qui décide d'une route se casse en silence le jour où
 * quelqu'un réordonne la liste, et l'erreur ressort en 500 sur une page qui
 * n'a rien changé. Un chemin qui ne peut pas se confondre avec un identifiant
 * ne dépend de personne. */
@Controller("admin/payment-stats")
@UseGuards(AdminGuard, RoleGuard)
export class PaymentStatsController {
  constructor(@Inject(PaymentStatsService) private readonly service: PaymentStatsService) {}

  /* Ouvert au support, comme les listes qu'il surveille : §6 lui accorde
     « consulter les paiements et les mouvements de crédits ». C'est la SORTIE
     en fichier qui lui reste fermée, et elle l'est ailleurs. */
  @Get()
  statistiques(
    @Query(new ZodValidationPipe(requeteStatsSchema)) requete: z.infer<typeof requeteStatsSchema>,
  ): Promise<StatsTransactions> {
    return this.service.statistiques(requete);
  }
}
