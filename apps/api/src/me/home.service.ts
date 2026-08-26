import { Inject, Injectable } from "@nestjs/common";
import type { Home } from "@lehno/contracts";
import { PrismaService } from "../prisma/prisma.service.js";
import { OccurrenceService } from "./occurrence.service.js";
import { ajouterJours } from "./calendrier.js";

// Combien de cartes l'accueil montre — spec technique §5.8 : « les trois
// échéances les plus proches ».
const CARTES = 3;

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
    const [utilisateur, cartes, aujourdhui, semaine, premierProche, nonLues] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { displayName: true, username: true },
      }),
      this.occurrences.list(userId, { limit: CARTES }),
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
    ]);

    return {
      // Le prénom n'a pas sa propre colonne : `display_name` est le nom
      // d'affichage libre du compte (facultatif), et la même retombée sert
      // déjà ailleurs — SignupService retombe sur `username` quand il est vide.
      firstName: utilisateur.displayName ?? utilisateur.username,
      occurrences: cartes,
      counts: { today: aujourdhui, thisWeek: semaine },
      unreadNotifications: nonLues,
      hasPersons: premierProche !== null,
    };
  }
}
