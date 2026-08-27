import { Inject, Injectable } from "@nestjs/common";
import type { Home } from "@lehno/contracts";
import { PrismaService } from "../prisma/prisma.service.js";
import { OccurrenceService } from "./occurrence.service.js";
import { ajouterJours } from "./calendrier.js";

/* Combien d'échéances l'accueil rend.
 *
 * La §5.8 disait « les trois échéances les plus proches ». Le kit mobile §3.2
 * en demande SEPT : trois cartes, puis quatre rangs. À trois, il n'y a jamais de
 * rang, jamais de reste, et l'état « Voir plus » est inatteignable — on aurait
 * livré un écran dont un tiers ne s'affiche dans aucune situation.
 *
 * Le design tranche. La spec suit. */
const ECHEANCES = 7;

/* L'horizon du décompte « n restants ».
 *
 * Il en faut un, et ce n'est pas un détail de réglage. Sans borne, le nombre
 * compterait toutes les échéances déroulées d'avance — or l'ordonnanceur en
 * ouvre trois par événement (voir PROFONDEUR). « Voir plus · 53 restants »
 * dirait alors la profondeur de déroulement, un détail interne, plutôt que ce
 * que la personne reconnaîtrait de son année.
 *
 * Douze mois : chaque date annuelle y paraît exactement une fois. Le nombre
 * redevient quelque chose qu'on peut lire — « quatorze autres dates cette
 * année ». */
const HORIZON_JOURS = 365;

@Injectable()
export class HomeService {
  // @Inject explicite : voir OccurrenceService/EventService, même contrainte
  // esbuild/vitest — design:paramtypes n'est pas émis, un paramètre typé sans
  // jeton explicite se résoudrait à `undefined` chez Nest.
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(OccurrenceService) private readonly occurrences: OccurrenceService,
  ) {}

  private aujourdhui(): string {
    return new Date().toISOString().slice(0, 10);
  }

  async get(userId: string): Promise<Home> {
    const jour = this.aujourdhui();
    // Semaine = les 7 prochains jours, aujourd'hui compris — la même borne que
    // celle qui ouvre la fenêtre des trois cartes.
    const finSemaine = ajouterJours(jour, 6);
    const lendemain = ajouterJours(jour, 1);
    const apresSemaine = ajouterJours(finSemaine, 1);

    // LE piège de cette tâche : les décomptes ne se déduisent PAS de la liste
    // plafonnée à trois cartes. Trois échéances rendues ne disent pas combien
    // il y en a cette semaine — ils se comptent SÉPARÉMENT, en base, sur la
    // table entière plutôt que sur l'extrait rendu au client.
    const [utilisateur, cartes, aujourdhui, semaine, premierProche, nonLues, dansLHorizon] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { displayName: true, username: true },
      }),
      this.occurrences.list(userId, { limit: ECHEANCES }),
      this.prisma.eventOccurrence.count({
        where: { userId, occurrenceDate: { gte: new Date(`${jour}T00:00:00Z`), lt: new Date(`${lendemain}T00:00:00Z`) } },
      }),
      this.prisma.eventOccurrence.count({
        where: { userId, occurrenceDate: { gte: new Date(`${jour}T00:00:00Z`), lt: new Date(`${apresSemaine}T00:00:00Z`) } },
      }),
      // Un booléen ne demande pas de compter tout le carnet : findFirst avec
      // une seule colonne sélectionnée s'arrête à la première ligne trouvée,
      // ce que count() ne ferait pas sur une fiche bien remplie. count()
      // n'accepte d'ailleurs pas `take`.
      this.prisma.person.findFirst({ where: { userId }, select: { id: true } }),
      // La cloche : `readAt` nullable, indexé par [userId, readAt].
      this.prisma.notification.count({ where: { userId, readAt: null } }),
      /* Tout ce qui vient dans l'horizon, RENDUES COMPRISES. On soustrait
         ensuite : compter « au-delà de la septième » demanderait de connaître la
         date de la septième, donc d'attendre la première requête pour lancer la
         seconde — deux allers-retours en base là où un seul suffit. */
      this.prisma.eventOccurrence.count({
        where: {
          userId,
          occurrenceDate: {
            gte: new Date(`${jour}T00:00:00Z`),
            lt: new Date(`${ajouterJours(jour, HORIZON_JOURS)}T00:00:00Z`),
          },
        },
      }),
    ]);

    return {
      // Le prénom n'a pas sa propre colonne : `display_name` est le nom
      // d'affichage libre du compte (facultatif), et la même retombée sert
      // déjà ailleurs — SignupService retombe sur `username` quand il est vide.
      firstName: utilisateur.displayName ?? utilisateur.username,
      occurrences: cartes,
      counts: { today: aujourdhui, thisWeek: semaine },
      unreadNotifications: nonLues,
      /* Ce qui reste APRÈS les échéances rendues. Jamais négatif : l'horizon du
         décompte et la liste rendue ne se recouvrent pas exactement — une
         échéance au-delà de douze mois figure dans la liste, qui n'est pas
         bornée, sans figurer dans le compte. Sans le plancher, un carnet aux
         dates lointaines afficherait « -2 restants ». */
      remainingOccurrences: Math.max(0, dansLHorizon - cartes.length),
      hasPersons: premierProche !== null,
    };
  }
}
