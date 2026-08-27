import { Inject, Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";

/* Ce qui met les rappels dans la file, avant que quiconque ne les envoie.
 *
 * Programmer et envoyer sont deux gestes distincts, et les séparer n'est pas du
 * zèle : la programmation se relance sans risque — elle ne fait qu'écrire des
 * lignes idempotentes —, alors que l'envoi, lui, ne se rejoue pas. Les mêler
 * ferait qu'une panne au milieu d'un passage renverrait ce qui était déjà parti.
 *
 * Le contrat commun l'exige : une notification transporte `titleKey` et
 * `bodyParams`, JAMAIS une phrase composée. La langue d'interface peut changer
 * après l'envoi, et une phrase figée resterait dans la langue d'hier.
 */

// Le canal `in_app` part TOUJOURS (§3.13 : les signalements « se retrouvent
// toujours dans ce centre »). Le téléphone et le courrier suivent les
// préférences — c'est ce que règle l'écran des rappels.
const TOUJOURS = "in_app" as const;

// Combien de jours de DÉCLENCHEMENTS on programme d'avance. Assez pour que
// l'ordonnanceur puisse manquer plusieurs jours sans qu'un rappel se perde,
// assez peu pour qu'une date corrigée ne laisse pas derrière elle une traînée
// de rappels faux.
const FENETRE_JOURS = 30;

type Preference = { type: string; pushEnabled: boolean; emailEnabled: boolean };

@Injectable()
export class ProgrammationService {
  private readonly logger = new Logger("programmation");

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private aujourdhui(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private async parametre(cle: string, defaut: number): Promise<number> {
    const l = await this.prisma.systemParameter.findUnique({ where: { key: cle } });
    const n = l ? Number(l.value) : NaN;
    return Number.isFinite(n) && n >= 0 ? n : defaut;
  }

  // Programme les rappels des échéances à venir.
  async programmerRappels(): Promise<{ posees: number }> {
    const defaut = await this.parametre("reminder_lead_days_default", 7);
    const depuis = this.aujourdhui();

    /* L'horizon n'est PAS le délai d'anticipation, et les confondre était mon
       erreur : un rappel à J-3 pour une échéance dans dix jours part dans sept
       jours, donc l'échéance doit entrer dans la fenêtre bien avant son rappel.
       Borner au délai seul revenait à ne jamais voir l'échéance à temps.
       
       On programme les DÉCLENCHEMENTS du mois qui vient. L'horizon en découle :
       le mois, plus le plus long délai enregistré — c'est exactement ce qu'il
       faut pour qu'aucun rappel du mois ne manque, sans remplir la file d'un an
       de lignes qu'une correction de date rendrait fausses. */
    const plusLong = await this.prisma.schedule.aggregate({ _max: { leadTimeDays: true } });
    const horizon = FENETRE_JOURS + Math.max(defaut, plusLong._max.leadTimeDays ?? 0);

    const echeances = await this.prisma.eventOccurrence.findMany({
      where: {
        occurrenceDate: {
          gte: new Date(`${depuis}T00:00:00Z`),
          lte: new Date(`${this.dans(horizon)}T00:00:00Z`),
        },
      },
      select: {
        id: true, userId: true, occurrenceDate: true,
        event: {
          select: {
            personId: true,
            schedules: { select: { leadTimeDays: true } },
          },
        },
      },
    });

    let posees = 0;
    for (const e of echeances) {
      const date = e.occurrenceDate.toISOString().slice(0, 10);

      /* Le délai vient de la règle de l'événement, ou du réglage global. Une
         règle qui n'en porte pas ne vaut pas « zéro » : elle vaut « comme tout
         le monde » — sinon composer une répétition ferait taire le rappel. */
      const delais = e.event.schedules
        .map((s) => s.leadTimeDays)
        .filter((d): d is number => d !== null);
      const anticipations = delais.length > 0 ? delais : [defaut];

      for (const jours of anticipations) {
        posees += await this.poser(e.userId, "event_reminder", {
          occurrenceId: e.id,
          personId: e.event.personId,
          quand: this.reculer(date, jours),
          titleKey: "notification.event_reminder",
          params: { days: jours, date },
          route: `/occurrences/${e.id}`,
          // Le délai entre dans la clé : deux rappels à J-7 et J-1 sont deux
          // faits distincts, pas un doublon.
          cle: `rappel:${e.id}:${jours}`,
        });
      }

      // Le jour même, toujours — c'est le fait que l'application promet.
      posees += await this.poser(e.userId, "event_day_of", {
        occurrenceId: e.id,
        personId: e.event.personId,
        quand: date,
        titleKey: "notification.event_day_of",
        params: { date },
        route: `/occurrences/${e.id}`,
        cle: `jour:${e.id}`,
      });
    }

    if (posees > 0) this.logger.log(`${posees} notifications programmées`);
    return { posees };
  }

  /* Pose une notification sur les canaux qui la veulent.
   *
   * `in_app` part toujours ; le courrier et le téléphone suivent les
   * préférences. Une ligne absente vaut le défaut activé — c'est ce que rend
   * déjà /me/notification-preferences, et les deux doivent dire la même chose.
   *
   * Le `dedupeKey` est UNIQUE en base : c'est lui qui rend la programmation
   * rejouable, et non un contrôle applicatif qui se perdrait entre la lecture
   * et l'écriture. On tente, on ignore le refus. */
  private async poser(
    userId: string,
    type: string,
    quoi: {
      occurrenceId?: string;
      personId?: string;
      quand: string;
      titleKey: string;
      params: Record<string, unknown>;
      route: string;
      cle: string;
    },
  ): Promise<number> {
    // Une notification datée d'hier n'a plus lieu d'être : on ne rattrape pas
    // un rappel manqué, on ne le fait pas sonner en retard.
    if (quoi.quand < this.aujourdhui()) return 0;

    const pref = await this.prisma.notificationPreference.findUnique({
      where: { userId_type: { userId, type: type as never } },
      select: { type: true, pushEnabled: true, emailEnabled: true },
    });
    const canaux = await this.canaux(userId, pref);

    let posees = 0;
    for (const canal of canaux) {
      try {
        await this.prisma.notification.create({
          data: {
            userId,
            type: type as never,
            channel: canal as never,
            ...(quoi.occurrenceId ? { eventOccurrenceId: quoi.occurrenceId } : {}),
            ...(quoi.personId ? { personId: quoi.personId } : {}),
            titleKey: quoi.titleKey,
            bodyParams: quoi.params as never,
            targetRoute: quoi.route,
            // Le canal entre dans la clé : la même nouvelle par courrier et
            // dans le centre sont deux lignes, pas un doublon.
            dedupeKey: `${quoi.cle}:${canal}`,
            scheduledFor: new Date(`${quoi.quand}T00:00:00Z`),
          },
        });
        posees += 1;
      } catch {
        // Déjà programmée par un passage précédent. C'est le cas NORMAL d'un
        // ordonnanceur quotidien, pas une anomalie : on n'en journalise rien.
      }
    }
    return posees;
  }

  private async canaux(userId: string, pref: Preference | null): Promise<string[]> {
    const liste: string[] = [TOUJOURS];
    // Rien d'enregistré vaut activé : voir NotificationPreferencesService, qui
    // rend le même défaut. Deux réponses différentes ici et là-bas feraient
    // mentir l'écran des rappels.
    if (pref === null || pref.emailEnabled) liste.push("email");

    /* Le téléphone n'entre dans la liste que si un appareil peut le recevoir.
       Poser une ligne `push` pour quelqu'un sans jeton d'appareil créerait une
       notification qui ne partira jamais et restera « en attente » pour
       toujours — une file qui ment sur ce qu'elle contient. */
    if (pref === null || pref.pushEnabled) {
      const appareils = await this.prisma.device.count({ where: { userId } });
      if (appareils > 0) liste.push("push");
    }
    return liste;
  }

  private dans(jours: number): string {
    return new Date(Date.now() + jours * 86_400_000).toISOString().slice(0, 10);
  }

  private reculer(date: string, jours: number): string {
    const [a, m, j] = date.split("-").map(Number) as [number, number, number];
    return new Date(Date.UTC(a, m - 1, j) - jours * 86_400_000).toISOString().slice(0, 10);
  }
}
