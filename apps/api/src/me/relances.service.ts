import { Inject, Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";

/* Les relances : aller chercher la matière quand rien n'arrive tout seul.
 *
 * Le produit repose sur ce qui a été noté — « lorsque rien n'a été noté, les
 * relances vont chercher la matière » (doc fonctionnelle §41). Sans elles, il
 * attend l'anniversaire en silence et découvre au dernier moment qu'il n'a rien
 * à dire.
 *
 * Trois natures, trois déclencheurs distincts :
 *
 * - GLOBALE — le carnet dort. Elle vise notamment quelqu'un entré récemment
 *   dans la vie de l'utilisateur et qui n'a pas encore de fiche : elle ne peut
 *   donc pas être déclenchée par une fiche, puisqu'elle sert à en créer une.
 * - PAR PERSONNE — une échéance approche ET la matière est ancienne. Le
 *   déclencheur est DOUBLE : l'échéance seule ne suffit pas (le rappel s'en
 *   charge), la fiche pauvre seule non plus (rien ne presse).
 * - ACTIVATION — les premiers pas d'un compte neuf. Bornée, plafonnée, et
 *   revérifiée AU MOMENT D'ENVOYER : voir plus bas, c'est le point qui compte.
 */

// Le seuil et la cadence valent la même chose — un mois. Quand c'est le cas,
// il n'y a plus qu'un paramètre : la cadence tombe du `dedupeKey`, qui porte le
// mois. Pas de second réglage, pas de compteur à tenir.
const SILENCE_DEFAUT = 30;
const FENETRE_ACTIVATION_DEFAUT = 21;
const PLAFOND_ACTIVATION_DEFAUT = 2;

// Une échéance dans cette fenêtre rend la relance par personne pertinente :
// assez tôt pour qu'il reste le temps de noter quelque chose, assez tard pour
// qu'on ne relance pas six mois à l'avance.
const APPROCHE_JOURS = 21;

type Activation = {
  type: string;
  titleKey: string;
  route: string;
  // Le but est-il ATTEINT ? Revérifié au moment d'envoyer, jamais seulement à
  // la programmation — voir le commentaire d'`activations`.
  atteint: (id: string, prisma: PrismaService) => Promise<boolean>;
};

const ACTIVATIONS: Activation[] = [
  {
    type: "activation_first_person",
    titleKey: "notification.activation_first_person",
    route: "/persons/new",
    atteint: async (id, p) => (await p.person.count({ where: { userId: id } })) > 0,
  },
  {
    type: "activation_first_note",
    titleKey: "notification.activation_first_note",
    route: "/notes/new",
    atteint: async (id, p) =>
      (await p.note.count({ where: { person: { userId: id } } })) > 0,
  },
  {
    // Le signal d'activation le plus fort du produit : la valeur est déjà là,
    // gratuite, et la personne n'a pas encore vu ce que l'application sait
    // faire. C'est le moment de le lui montrer — pas au moment de payer.
    type: "activation_unused_credits",
    titleKey: "notification.activation_unused_credits",
    route: "/home",
    atteint: async (id, p) =>
      (await p.creditTransaction.count({ where: { userId: id, amount: { lt: 0 } } })) > 0,
  },
];

@Injectable()
export class RelancesService {
  private readonly logger = new Logger("relances");

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private aujourdhui(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private async parametre(cle: string, defaut: number): Promise<number> {
    const l = await this.prisma.systemParameter.findUnique({ where: { key: cle } });
    const n = l ? Number(l.value) : NaN;
    return Number.isFinite(n) && n >= 0 ? n : defaut;
  }

  private ilYA(jours: number): Date {
    return new Date(Date.now() - jours * 86_400_000);
  }

  /* Le carnet dort depuis un mois : on relance, au plus une fois par mois.
   *
   * La cadence ne se règle pas : elle vient du `dedupeKey`, qui porte le mois
   * courant. Un compteur séparé se désynchroniserait de la file ; la clé, elle,
   * est la file. */
  async enrichissementGlobal(): Promise<number> {
    const silence = await this.parametre("nudge_silence_days", SILENCE_DEFAUT);
    const seuil = this.ilYA(silence);
    const mois = this.aujourdhui().slice(0, 7);

    /* Les comptes SANS note récente. Le `none` couvre les deux cas d'un seul
       coup — celui qui n'a jamais rien noté, et celui qui s'est tu depuis un
       mois — alors qu'un `max(createdAt) < seuil` raterait le premier, qui est
       pourtant celui dont on a le plus besoin. */
    const comptes = await this.prisma.user.findMany({
      where: {
        status: "active",
        people: { every: { notes: { none: { createdAt: { gte: seuil } } } } },
      },
      select: { id: true },
    });

    let posees = 0;
    for (const c of comptes) {
      posees += await this.poser(c.id, "enrichment_nudge_global", {
        titleKey: "notification.enrichment_nudge_global",
        params: { silenceDays: silence },
        route: "/persons",
        cle: `enrichissement:${c.id}:${mois}`,
      });
    }
    return posees;
  }

  /* Une échéance approche ET la fiche est muette. Le déclencheur est double :
     l'échéance seule est déjà couverte par le rappel, et une fiche pauvre sans
     échéance ne presse pas. */
  async enrichissementParPersonne(): Promise<number> {
    const silence = await this.parametre("nudge_silence_days", SILENCE_DEFAUT);
    const seuil = this.ilYA(silence);
    const depuis = this.aujourdhui();
    const jusqu = new Date(Date.now() + APPROCHE_JOURS * 86_400_000)
      .toISOString().slice(0, 10);

    const echeances = await this.prisma.eventOccurrence.findMany({
      where: {
        occurrenceDate: {
          gte: new Date(`${depuis}T00:00:00Z`),
          lte: new Date(`${jusqu}T00:00:00Z`),
        },
        event: { person: { notes: { none: { createdAt: { gte: seuil } } } } },
      },
      select: {
        id: true, userId: true,
        event: { select: { personId: true, person: { select: { displayName: true } } } },
      },
    });

    let posees = 0;
    for (const e of echeances) {
      posees += await this.poser(e.userId, "enrichment_nudge_person", {
        occurrenceId: e.id,
        personId: e.event.personId,
        titleKey: "notification.enrichment_nudge_person",
        // Sans le nom, ce message ne veut rien dire : il parle d'une personne
        // précise dont on n'a rien noté.
        params: { person: e.event.person.displayName },
        route: `/persons/${e.event.personId}`,
        // Une seule fois par échéance : la suivante relancera d'elle-même.
        cle: `matiere:${e.id}`,
      });
    }
    return posees;
  }

  /* Les premiers pas d'un compte neuf.
   *
   * Le but se revérifie ICI, à chaque passage, et pas seulement au moment de
   * poser la ligne. C'est la condition non négociable : envoyer « créez votre
   * premier proche » à quelqu'un qui en a douze détruit la confiance plus
   * sûrement que dix relances de trop. La file peut avoir été garnie hier, et
   * la personne avoir agi ce matin. */
  async activations(): Promise<number> {
    const fenetre = await this.parametre("activation_window_days", FENETRE_ACTIVATION_DEFAUT);
    const plafond = await this.parametre("activation_max_sends", PLAFOND_ACTIVATION_DEFAUT);

    const comptes = await this.prisma.user.findMany({
      where: {
        status: "active",
        // Le renoncement, posé depuis le lien d'un courrier : il coupe TOUTES
        // les relances d'activation d'un coup, sans connexion.
        activationEmailsOptedOut: false,
        createdAt: { gte: this.ilYA(fenetre) },
      },
      select: { id: true, createdAt: true },
    });

    let posees = 0;
    for (const c of comptes) {
      for (const a of ACTIVATIONS) {
        if (await a.atteint(c.id, this.prisma)) continue;

        // Le plafond se compte sur ce qui a DÉJÀ été posé pour cette nature :
        // pas de colonne de comptage à tenir à jour, donc rien à
        // désynchroniser.
        const deja = await this.prisma.notification.count({
          where: { userId: c.id, type: a.type as never, channel: "email" },
        });
        if (deja >= plafond) continue;

        posees += await this.poser(c.id, a.type, {
          titleKey: a.titleKey,
          params: { envoi: deja + 1 },
          route: a.route,
          cle: `activation:${c.id}:${a.type}:${deja + 1}`,
          // L'activation ne se règle pas dans l'application : elle passe par le
          // courrier et le centre, jamais par le téléphone. Une notification
          // poussée « créez votre premier proche » serait de la relance
          // marchande sur l'écran de verrouillage.
          canaux: ["in_app", "email"],
        });
      }
    }
    if (posees > 0) this.logger.log(`${posees} relances d'activation programmées`);
    return posees;
  }

  private async poser(
    userId: string,
    type: string,
    quoi: {
      occurrenceId?: string;
      personId?: string;
      titleKey: string;
      params: Record<string, unknown>;
      route: string;
      cle: string;
      canaux?: string[];
    },
  ): Promise<number> {
    const canaux = quoi.canaux ?? (await this.canaux(userId, type));
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
            dedupeKey: `${quoi.cle}:${canal}`,
            scheduledFor: new Date(),
          },
        });
        posees += 1;
      } catch {
        // Déjà posée. Cas normal d'un passage quotidien.
      }
    }
    return posees;
  }

  private async canaux(userId: string, type: string): Promise<string[]> {
    const liste = ["in_app"];
    const pref = await this.prisma.notificationPreference.findUnique({
      where: { userId_type: { userId, type: type as never } },
      select: { emailEnabled: true, pushEnabled: true },
    });
    if (pref === null || pref.emailEnabled) liste.push("email");
    if (pref === null || pref.pushEnabled) {
      if ((await this.prisma.device.count({ where: { userId } })) > 0) liste.push("push");
    }
    return liste;
  }
}
