import { Controller, Get, Inject, Injectable, Query, UseGuards } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { PrismaService } from "../prisma/prisma.service.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { AdminGuard } from "./admin.guard.js";
import { RoleGuard } from "./role.guard.js";

/** Les périodes proposées, et ce qu'elles valent en jours. Une liste fermée :
 *  « choisir la période » (ux-admin §5.11) est un geste de lecture, pas la
 *  construction d'un intervalle libre que rien n'indexe. */
const JOURS = { "7j": 7, "30j": 30, "90j": 90, "12m": 365 } as const;

/** Le type se déduit de la table plutôt que d'être redit à côté : deux listes
 *  de périodes finiraient par diverger, et l'une d'elles rendrait `undefined`
 *  là où l'autre promet un nombre. */
export type Periode = keyof typeof JOURS;

const PERIODE_DEFAUT: Periode = "30j";

/** Les cohortes couvrent toujours les douze derniers mois. */
const MOIS_DE_COHORTES = 11;

export const requeteMetriquesSchema = z.object({
  periode: z.enum(["7j", "30j", "90j", "12m"]).optional(),
}).strict();

/** Ce que §5.11 demande et dont aucune source n'existe dans ce dépôt.
 *
 *  Déclaré par le serveur, et non écrit en dur dans la page : le jour où la
 *  source arrive, c'est ici qu'on retire la ligne, et l'écran suit. Personne
 *  n'a à se souvenir d'aller décrocher un avertissement ailleurs.
 *
 *  - `usage_par_fonctionnalite` — le plan de marquage part vers PostHog en
 *    aveugle (`tracking.service.ts`) ; rien n'est conservé ici.
 *  - `contributions` — les surfaces qui les produisent n'existent pas encore.
 */
const MANQUES = ["usage_par_fonctionnalite", "contributions"] as const;

type LigneCohorte = { mois: string; inscrits: number; actifsA7j: number; actifsA30j: number };
type LigneConversion = { comptes: number; acheteurs: number; delai: number | null };
type LignePalier = { credits: number; achats: number };
type LigneAction = {
  code: string; lancements: number; reussies: number; echouees: number; enAttente: number;
};

@Injectable()
export class MetriquesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async etat(requete: z.infer<typeof requeteMetriquesSchema>) {
    const periode = requete.periode ?? PERIODE_DEFAUT;
    const depuis = new Date(Date.now() - JOURS[periode] * 24 * 60 * 60_000);

    const [cohortes, conversion, paliers, consommation, actions] = await Promise.all([
      this.cohortes(),
      this.conversion(depuis),
      this.paliers(depuis),
      this.consommation(depuis),
      this.actions(depuis),
    ]);

    return {
      periode,
      retention: { cohortes },
      conversion: {
        comptes: conversion.comptes,
        acheteurs: conversion.acheteurs,
        delaiMedianJours: conversion.delai,
        parPalier: paliers,
      },
      consommation,
      actions,
      manques: [...MANQUES],
    };
  }

  /**
   * Les cohortes ne suivent PAS la période choisie, et c'est délibéré : sur
   * sept jours, la colonne « J+30 » ne pourrait qu'afficher zéro pour tout le
   * monde. Ce zéro se lirait comme une fuite alors qu'il ne dit que « c'est
   * trop tôt » — et un chiffre qu'on ne peut pas encore mesurer ne doit pas
   * ressembler à une mesure (écart H).
   *
   * En SQL et non en Prisma : la fenêtre de retour se compte **par compte**,
   * depuis sa propre date d'entrée. Reconstituer cela en JavaScript
   * demanderait de rapatrier toutes les connexions de l'année.
   */
  private async cohortes(): Promise<LigneCohorte[]> {
    // `::int` sur les deux durées, et ce n'est pas décoratif : Prisma passe les
    // nombres de JavaScript en `bigint`, et `make_interval` n'a pas de
    // surcharge pour ce type. Sans le cast, Postgres refuse la fonction.

    // Une tentative ratée n'est pas un retour : elle dit qu'on a essayé, pas
    // qu'on est entré. Les compter gonflerait la rétention de tout compte dont
    // quelqu'un cherche l'accès.
    const revenu = (jours: number) => Prisma.sql`
      EXISTS (
        SELECT 1 FROM login_activity la
        WHERE la.user_id = u.id
          AND la.result = 'success'
          AND la.created_at > u.created_at
          AND la.created_at <= u.created_at + make_interval(days => ${jours}::int)
      )`;

    return this.prisma.$queryRaw<LigneCohorte[]>`
      SELECT to_char(date_trunc('month', u.created_at), 'YYYY-MM') AS "mois",
             count(*)::int AS "inscrits",
             count(*) FILTER (WHERE ${revenu(7)})::int AS "actifsA7j",
             count(*) FILTER (WHERE ${revenu(30)})::int AS "actifsA30j"
      FROM "user" u
      WHERE u.created_at >= date_trunc('month', now())
                            - make_interval(months => ${MOIS_DE_COHORTES}::int)
      GROUP BY 1
      ORDER BY 1`;
  }

  /**
   * La conversion se lit sur les comptes **entrés** dans la période, et non sur
   * les paiements qui y sont tombés : c'est la part d'une arrivée qui achète
   * qu'on cherche, pas le chiffre d'affaires — le tableau de bord le porte déjà.
   *
   * `percentile_cont` et non une moyenne : trois acheteurs à 1, 2 et 30 jours
   * ont une médiane de 2 et une moyenne de 11. Un seul compte parti tard ferait
   * croire à un cycle d'achat long qui n'existe pour personne.
   */
  private async conversion(depuis: Date): Promise<LigneConversion> {
    // `percentile_cont` sur un ensemble vide rend `null`, et un `SELECT` sans
    // `FROM` rend toujours une ligne : le tableau n'est jamais vide. Le typage
    // ne peut pas le savoir, d'où la valeur de repli — qui ne sert jamais.
    const [ligne] = await this.prisma.$queryRaw<LigneConversion[]>`
      WITH comptes AS (
        SELECT u.id, u.created_at FROM "user" u WHERE u.created_at >= ${depuis}
      ),
      premiers AS (
        SELECT c.id, c.created_at, min(p.created_at) AS premier
        FROM comptes c
        JOIN payment p ON p.user_id = c.id
        WHERE p.status = 'succeeded' AND p.direction = 'charge'
        GROUP BY c.id, c.created_at
      )
      SELECT (SELECT count(*) FROM comptes)::int AS "comptes",
             (SELECT count(*) FROM premiers)::int AS "acheteurs",
             (SELECT percentile_cont(0.5) WITHIN GROUP (
                ORDER BY EXTRACT(EPOCH FROM (pr.premier - pr.created_at)) / 86400)
              FROM premiers pr) AS "delai"`;
    return ligne ?? { comptes: 0, acheteurs: 0, delai: null };
  }

  /** Le palier se désigne par ses crédits ; la phrase appartient à l'écran, qui
   *  sait dans quelle langue il se lit. Un paiement sans palier — une correction
   *  saisie à la main — n'entre pas dans la répartition : il n'en a pas. */
  private paliers(depuis: Date): Promise<LignePalier[]> {
    return this.prisma.$queryRaw<LignePalier[]>`
      SELECT cb.credits::int AS "credits", count(*)::int AS "achats"
      FROM payment p
      JOIN credit_bundle cb ON cb.id = p.credit_bundle_id
      JOIN "user" u ON u.id = p.user_id
      WHERE u.created_at >= ${depuis}
        AND p.status = 'succeeded' AND p.direction = 'charge'
      GROUP BY cb.credits
      ORDER BY cb.credits`;
  }

  /**
   * Les exécutions d'une action payante, et leur issue.
   *
   * **Toutes les actions, pas seulement celles qu'on a lancées.** Une jointure
   * externe depuis `premium_action` : une action que personne n'emploie sort à
   * zéro plutôt que de disparaître. Sans elle, « le portrait ne sert pas » et
   * « le portrait n'existe pas » se ressemblent à l'écran, et ce sont deux
   * informations opposées.
   *
   * Les trois issues sont comptées séparément et redonnent le total — le
   * contrat le vérifie, parce qu'un écart se lirait comme un taux d'échec.
   */
  private actions(depuis: Date): Promise<LigneAction[]> {
    return this.prisma.$queryRaw<LigneAction[]>`
      SELECT pa.code AS "code",
             count(ar.id)::int AS "lancements",
             count(ar.id) FILTER (WHERE ar.status = 'success')::int AS "reussies",
             count(ar.id) FILTER (WHERE ar.status = 'failure')::int AS "echouees",
             count(ar.id) FILTER (WHERE ar.status = 'pending')::int AS "enAttente"
      FROM premium_action pa
      LEFT JOIN action_run ar
        ON ar.premium_action_id = pa.id AND ar.created_at >= ${depuis}
      GROUP BY pa.code
      ORDER BY pa.code`;
  }

  /** Le registre porte les débits en négatif ; un volume ne se lit pas avec un
   *  signe moins. La somme est donc rendue en valeur absolue. */
  private async consommation(depuis: Date) {
    const { _sum, _count } = await this.prisma.creditTransaction.aggregate({
      where: { type: "consumption", createdAt: { gte: depuis } },
      _sum: { amount: true },
      _count: true,
    });
    return { credits: Math.abs(_sum.amount ?? 0), mouvements: _count };
  }
}

@Controller("admin")
@UseGuards(AdminGuard, RoleGuard)
export class MetriquesController {
  constructor(@Inject(MetriquesService) private readonly service: MetriquesService) {}

  /** Ouvert au support : §6 lui accorde « consulter le tableau de bord, les
   *  métriques, les connexions ». C'est la SORTIE en fichier qui lui est
   *  fermée, et elle l'est dans `exports.controller.ts`. Voir une liste et
   *  pouvoir la sortir sont deux choses. */
  @Get("metrics")
  etat(@Query(new ZodValidationPipe(requeteMetriquesSchema)) requete: z.infer<typeof requeteMetriquesSchema>) {
    return this.service.etat(requete);
  }
}
