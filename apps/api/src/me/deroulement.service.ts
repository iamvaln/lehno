import { Inject, Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { echeances, type Regle, type UniteRegle, ajouterJours, ajouterMois } from "./calendrier.js";

/* Ce qui fait vivre les dates dans le temps.
 *
 * Jusqu'ici, une échéance s'ouvrait à la CRÉATION de l'événement, et une seule.
 * Passée, rien n'ouvrait la suivante : l'application se taisait au bout d'un an,
 * sans erreur nulle part et sans que personne ne s'en aperçoive avant le premier
 * anniversaire manqué. C'est le défaut le plus coûteux du produit, parce qu'il
 * ne se voit pas — il se constate.
 *
 * Le déroulement est IDEMPOTENT : le relancer deux fois dans la même journée ne
 * doit rien produire de plus. C'est la propriété qui compte, parce qu'un
 * ordonnanceur se relance — au redémarrage, après une panne, ou parce que deux
 * instances tournent. La garantie ne vient pas d'un verrou applicatif mais de la
 * contrainte d'unicité (eventId, occurrenceDate) : deux passages concurrents
 * échouent sur la seconde écriture au lieu de doubler. */

// Combien d'échéances on garde ouvertes DEVANT chaque événement.
//
// Une seule suffirait au rappel, mais l'écran Dates montre un mois et la vue
// calendrier en montre douze : sans profondeur, un mois de février paraîtrait
// vide alors qu'il porte trois anniversaires. Trois est le compromis — assez
// pour remplir un calendrier, assez peu pour qu'une correction de règle ne
// laisse pas derrière elle une traînée d'échéances fausses.
const PROFONDEUR = 3;

type RegleLigne = {
  type: string;
  unit: string | null;
  interval: number | null;
  offsetUnit: string | null;
  offsetAmount: number | null;
};

@Injectable()
export class DeroulementService {
  private readonly logger = new Logger("deroulement");

  // @Inject explicite : voir EventService/OccurrenceService, même contrainte
  // esbuild/vitest — design:paramtypes n'est pas émis.
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private aujourdhui(): string {
    return new Date().toISOString().slice(0, 10);
  }

  /* Déroule TOUS les événements du dépôt, et rend ce qu'il a ouvert.
   *
   * Pas de filtrage par compte : c'est un traitement de fond, pas une lecture
   * d'utilisateur. Il n'expose rien — aucun chemin HTTP ne l'atteint — donc la
   * question du cloisonnement ne se pose pas ici ; elle se poserait si on le
   * déclenchait depuis une requête, et c'est pourquoi on ne le fait pas. */
  async derouler(): Promise<{ ouvertes: number; evenements: number }> {
    const depuis = this.aujourdhui();

    /* On ne parcourt QUE les événements à court d'échéances à venir.
     *
     * Charger tout le dépôt pour recalculer ce qui existe déjà coûterait cher
     * pour rien : à mille comptes, la grande majorité des événements ont leurs
     * trois échéances ouvertes et n'ont rien à faire ici. */
    const evenements = await this.prisma.event.findMany({
      select: {
        id: true, referenceDate: true,
        person: { select: { userId: true } },
        schedules: {
          select: {
            type: true, unit: true, interval: true,
            offsetUnit: true, offsetAmount: true,
          },
        },
        occurrences: {
          where: { occurrenceDate: { gte: new Date(`${depuis}T00:00:00Z`) } },
          select: { occurrenceDate: true },
        },
      },
    });

    let ouvertes = 0;
    let touches = 0;

    for (const e of evenements) {
      const manquantes = PROFONDEUR - e.occurrences.length;
      if (manquantes <= 0) continue;

      const reference = e.referenceDate.toISOString().slice(0, 10);
      const dejaLa = new Set(
        e.occurrences.map((o) => o.occurrenceDate.toISOString().slice(0, 10)),
      );

      const candidates = this.prochaines(reference, e.schedules, depuis, PROFONDEUR)
        .filter((d) => !dejaLa.has(d));

      if (candidates.length === 0) continue;
      touches += 1;

      for (const date of candidates.slice(0, manquantes)) {
        try {
          await this.prisma.eventOccurrence.create({
            data: {
              eventId: e.id,
              userId: e.person.userId,
              occurrenceDate: new Date(`${date}T00:00:00Z`),
              occurrenceYear: Number(date.slice(0, 4)),
            },
          });
          ouvertes += 1;
        } catch {
          /* La contrainte d'unicité a parlé : un autre passage a ouvert la même
             échéance entre notre lecture et notre écriture. C'est précisément ce
             qu'on veut — on l'ignore et on continue, plutôt que de tenir un
             verrou qui, lui, se perdrait au redémarrage. */
        }
      }
    }

    if (ouvertes > 0) {
      // Le journal ne porte ni compte ni proche : un déroulement se mesure en
      // nombres, et le nom de qui fête son anniversaire n'a rien à y faire.
      this.logger.log(`${ouvertes} échéances ouvertes sur ${touches} événements`);
    }
    return { ouvertes, evenements: touches };
  }

  /* Les prochaines dates d'un événement, d'après ses règles.
   *
   * Même raisonnement qu'EventService.ouvrirProchaine, à une différence près :
   * on en demande PLUSIEURS. Une règle récurrente en donne autant qu'on veut ;
   * une règle décalée n'en donne qu'une, puisqu'elle désigne un point fixe
   * après la référence et non une série. */
  private prochaines(
    reference: string,
    regles: RegleLigne[],
    depuis: string,
    combien: number,
  ): string[] {
    if (regles.length === 0) {
      // Sans règle, l'événement n'a qu'une date : la sienne. Une fois passée,
      // il n'y a plus rien à ouvrir — un mariage ne se répète pas tous les ans.
      return reference >= depuis ? [reference] : [];
    }

    const dates = new Set<string>();
    for (const r of regles) {
      if (r.type === "recurrent" && r.unit !== null && r.interval !== null) {
        const regle: Regle = { unite: r.unit as UniteRegle, pas: r.interval };
        for (const d of echeances(reference, regle, depuis, combien)) dates.add(d);
      } else if (r.offsetUnit !== null && r.offsetAmount !== null) {
        const decalee = r.offsetUnit === "day"
          ? ajouterJours(reference, r.offsetAmount)
          : ajouterMois(reference, r.offsetAmount);
        if (decalee >= depuis) dates.add(decalee);
      }
    }
    // Triées : le `slice` du plafond doit prendre les plus PROCHES, sinon on
    // ouvrirait 2029 en laissant 2027 de côté.
    return [...dates].sort();
  }
}
