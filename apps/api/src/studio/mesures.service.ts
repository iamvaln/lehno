import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { StudioConfigKind } from "@prisma/client";
import type { MesureModele, MesuresDesModeles } from "@lehno/contracts";
import { PrismaService } from "../prisma/prisma.service.js";

/**
 * CE QUE LES PRODUCTIONS DE CHAQUE MODÈLE ONT VALU.
 *
 * CE SERVICE NE COMPTE PLUS PAR VERSION : `StudioPerformanceService` le fait, et
 * deux implémentations du même compte auraient fini par diverger — c'est même
 * arrivé le jour de leur écriture, à quelques heures d'écart. Il ne reste ici
 * que la question que l'autre ne pose pas : « ce modèle vaut-il son prix ? ».
 *
 * Il mesure L'AVIS et lui seul — le pouce —, jamais le geste. Un modèle ne
 * décide pas qu'on envoie un message ou qu'on garde un portrait : mille choses
 * s'y mêlent. Ce qu'on lui impute, c'est ce qu'on a pensé de ce qu'il a rendu.
 *
 * L'ancien en-tête disait : les mesures d'une nature.
 *
 * « Aucune production ne porte d'avis, et aucune ne dit sur quelle version elle
 * a été produite. Les deux manquent ensemble, et il les faut ensemble : un
 * pouce en bas sans savoir quelle version l'a produit ne mesure rien, et une
 * version publiée sans avis ne dit pas si elle vaut mieux que la précédente. »
 *
 * Les deux existent maintenant. Ce service les rapproche.
 */

/* LE SEUIL, sous lequel on ne conclut pas.
 *
 * Il porte sur les AVIS et non sur les productions, puisque c'est d'eux que le
 * taux se tire. En dessous, la mesure rend un taux NUL — « trop tôt » — plutôt
 * qu'un pourcentage : sinon le premier rejet d'une version neuve l'affiche à
 * cent pour cent, et quelqu'un revient en arrière sur un accident.
 *
 * Cinq est un choix provisoire et assumé : il n'y a pas encore de volumes réels
 * à regarder. Il vit ICI et voyage avec la mesure, pour que l'ajuster demain ne
 * demande de toucher qu'un endroit. */
const SEUIL = 5;

/* CE QUI COMPTE COMME PRODUCTION, nature par nature.
 *
 * Pour les idées, l'unité est L'IDÉE et non le jeu : l'avis se pose par
 * proposition, et compter les jeux mettrait cinq avis sur une seule ligne. Les
 * chiffres d'une nature ne se comparent donc jamais à ceux d'une autre — on
 * compare une version à la précédente, DE LA MÊME nature. */
type Compte = { productions: number; avis: number; rejets: number };

@Injectable()
export class MesuresStudioService {
  // @Inject explicite : esbuild/vitest n'émet pas design:paramtypes.
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /* LES MODÈLES, TOUTES NATURES CONFONDUES — la question du registre.
   *
   * « Ce modèle vaut-il son prix ? » ne se pose pas par nature : un modèle sert
   * le message ET les idées, et son tarif est le même partout. C'est donc la
   * somme qu'on veut.
   *
   * ON ADDITIONNE LES COMPTES, JAMAIS LES TAUX. Trois natures à 10 %, 50 % et
   * 0 % ne font pas 20 % : la moyenne des taux ignore le nombre d'avis
   * derrière chacun, et donnerait autant de poids à une nature notée trois fois
   * qu'à une notée trois cents. Le taux se recalcule à la fin, sur les totaux —
   * et le seuil s'y applique comme ailleurs. */
  async mesurerLesModeles(): Promise<MesuresDesModeles> {
    const parCle = new Map<string, MesureModele>();

    /* `portrait_brief` n'est pas là : aucune production ne porte sa version, et
       ses appels sont déjà comptés dans ceux du portrait — son brief et son
       image partagent une exécution. L'y ajouter compterait deux fois. */
    for (const nature of ["message", "idees", "portrait"] as const) {
      for (const m of await this.parModele(nature)) {
        const vu = parCle.get(`${m.fournisseur}:${m.cle}`);
        if (vu === undefined) {
          parCle.set(`${m.fournisseur}:${m.cle}`, { ...m });
          continue;
        }
        vu.productions += m.productions;
        vu.avis += m.avis;
        vu.rejets += m.rejets;
      }
    }

    return {
      seuil: SEUIL,
      modeles: [...parCle.values()]
        .map((m) => ({ ...m, taux: this.taux(m) }))
        .sort((a, b) => b.productions - a.productions),
    };
  }

  /** Nul sous le seuil : « trop tôt pour conclure », jamais zéro. */
  private taux(c: Compte): number | null {
    return c.avis < SEUIL ? null : c.rejets / c.avis;
  }

  /* PAR MODÈLE — « ce modèle vaut-il son prix ? ». Un tarif sans taux de rejet
   * ne dit que la moitié : le moins cher peut coûter le plus, en productions
   * refaites.
   *
   * ON NE RETIENT QUE LA TENTATIVE QUI A ABOUTI. Un repli laisse plusieurs
   * lignes d'usage pour une seule production, et compter toute la chaîne
   * chargerait le modèle qui a échoué AVANT d'avoir rien écrit — c'est-à-dire
   * exactement l'inverse de ce qu'on mesure. */
  private async parModele(nature: StudioConfigKind): Promise<MesureModele[]> {
    const lignes = await this.prisma.$queryRaw<
      { cle: string; fournisseur: string; productions: bigint; avis: bigint; rejets: bigint }[]
    >(this.requeteParModele(nature));

    return lignes.map((l) => {
      const compte = {
        productions: Number(l.productions),
        avis: Number(l.avis),
        rejets: Number(l.rejets),
      };
      return { cle: l.cle, fournisseur: l.fournisseur, ...compte, taux: this.taux(compte) };
    });
  }

  private requeteParModele(nature: StudioConfigKind): Prisma.Sql {
    /* LA TÂCHE, et non la nature : une exécution de portrait laisse DEUX usages
       réussis — le brief qui écrit les mots, et le modèle d'image qui dessine.
       Sans ce filtre, chaque portrait compterait deux fois et chargerait le
       modèle de texte d'un rejet qui vise le dessin. */
    const taches = nature === "portrait"
      ? Prisma.sql`('illustration', 'photo_style')`
      : nature === "idees"
        ? Prisma.sql`('gift_ideas')`
        : Prisma.sql`('message')`;

    const production = nature === "portrait"
      ? Prisma.sql`SELECT "action_run_id", "feedback" FROM "portrait"`
      : nature === "idees"
        /* L'avis est sur L'IDÉE, l'exécution sur le JEU : on redescend jusqu'à
           l'idée pour que cinq propositions pèsent cinq avis, et non un. */
        ? Prisma.sql`
            SELECT s."action_run_id", i."feedback"
            FROM "generated_idea" i
            JOIN "generated_idea_set" s ON s."id" = i."set_id"`
        : Prisma.sql`SELECT "action_run_id", "feedback" FROM "generated_message"`;

    /* `DISTINCT ON` sur l'exécution : un repli laisse plusieurs lignes d'usage
       pour la même tâche, et sans lui une production compterait deux fois.
       L'ORDRE DOIT ÊTRE TOTAL, et il ne l'était pas. `attempt` seul ne
       départage rien : la chaîne écrit `attempt: c.rank`, et ce rang vaut ZÉRO
       sur le chemin ordinaire — deux lignes du même appel portent donc le même.
       Postgres choisissait alors arbitrairement, et la mesure pouvait nommer un
       modèle un jour et l'autre le lendemain, sans que rien ne change.
       `created_at` ferme l'ordre : à rang égal, c'est la PREMIÈRE écrite qui
       compte, c'est-à-dire celle qui a effectivement rendu le contenu. */
    return Prisma.sql`
      WITH production AS (${production}),
      abouti AS (
        SELECT DISTINCT ON (u."action_run_id")
          u."action_run_id", u."provider", u."model_key"
        FROM "ai_usage" u
        WHERE u."status" = 'success'
          AND u."purpose"::text IN ${taches}
          AND u."action_run_id" IS NOT NULL
        ORDER BY u."action_run_id", u."attempt" ASC, u."created_at" ASC
      )
      SELECT
        a."model_key" AS cle,
        a."provider"  AS fournisseur,
        COUNT(*)                                        AS productions,
        COUNT(*) FILTER (WHERE p."feedback" IS NOT NULL) AS avis,
        COUNT(*) FILTER (WHERE p."feedback" = 'down')    AS rejets
      FROM production p
      JOIN abouti a ON a."action_run_id" = p."action_run_id"
      GROUP BY a."model_key", a."provider"
      ORDER BY productions DESC`;
  }
}
