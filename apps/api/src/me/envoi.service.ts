import { Inject, Injectable, Logger } from "@nestjs/common";
import { phraseDeNotification, type Locale } from "@lehno/i18n";
import { PrismaService } from "../prisma/prisma.service.js";
import type { MailPort } from "../mail/mail.port.js";
import type { PushPort } from "../notifications/push.port.js";

/* L'envoi de ce que la programmation a mis en file.
 *
 * Séparé de la programmation, et c'est la seule chose qui compte ici : la
 * programmation se rejoue sans risque, l'envoi non. Mêlés, une panne au milieu
 * d'un passage renverrait ce qui était déjà parti.
 *
 * D'où la règle : on marque AVANT d'envoyer, jamais après.
 *
 * Marquer après serait plus intuitif — « c'est parti, donc je le note » — et
 * c'est exactement le piège. Une panne entre l'envoi et la marque laisserait la
 * ligne en attente, et le passage suivant renverrait le même courrier. Marquer
 * d'abord fait courir le risque INVERSE : une panne perd un envoi. Entre
 * réenvoyer et perdre, on choisit de perdre — un rappel manqué se rattrape à
 * l'échéance suivante, un courrier reçu trois fois ne se rattrape pas.
 */

// Combien de notifications on traite par passage. Une file qui a pris du retard
// ne doit pas monopoliser le processus ni le courrielleur : le passage suivant
// reprendra la suite, quelques minutes plus tard.
const LOT = 200;

type Ligne = {
  id: string;
  type: string;
  channel: string;
  titleKey: string;
  bodyParams: unknown;
  targetRoute: string | null;
  user: {
    email: string;
    uiLanguage: string;
    devices: { pushToken: string }[];
  };
};

@Injectable()
export class EnvoiService {
  private readonly logger = new Logger("envoi");

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject("MAIL_PORT") private readonly mail: MailPort,
    @Inject("PUSH_PORT") private readonly push: PushPort,
  ) {}

  /* Le bilan compte SÉPARÉMENT ce qui a échoué et ce qui était impossible.
     Un seul nombre ferait passer pour une panne du relais ce qui n'est qu'une
     application désinstallée, et l'inverse : c'est précisément la confusion
     que le statut `invalid` existe pour lever. */
  async envoyer(): Promise<{ envoyees: number; echouees: number; impossibles: number }> {
    const dues = await this.prisma.notification.findMany({
      where: {
        status: "pending",
        /* Les deux surfaces que le SERVEUR sert. `in_app` n'est pas ici :
           le centre se lit dans l'application, qui rend le texte depuis la
           clé — rien à envoyer, donc rien à prendre. */
        channel: { in: ["email", "push"] },
        // `scheduledFor` nul veut dire « tout de suite » : les relances
        // n'attendent pas une date, elles attendent le prochain passage.
        OR: [{ scheduledFor: null }, { scheduledFor: { lte: new Date() } }],
      },
      orderBy: { scheduledFor: "asc" },
      take: LOT,
      select: {
        id: true, type: true, channel: true, titleKey: true, bodyParams: true,
        targetRoute: true,
        user: {
          select: {
            email: true, uiLanguage: true,
            /* Les appareils se lisent ICI, pas à la programmation.
               La programmation ne pose une ligne `push` que si un appareil
               existe, mais entre-temps quelqu'un peut désinstaller
               l'application ou se déconnecter. Relire au moment de l'envoi
               évite de parler à un appareil qui n'écoute plus. */
            devices: { where: { isActive: true }, select: { pushToken: true } },
          },
        },
      },
    });

    let envoyees = 0;
    let echouees = 0;
    let impossibles = 0;

    for (const n of dues as Ligne[]) {
      const langue = (n.user.uiLanguage === "en" ? "en" : "fr") as Locale;

      /* La phrase se compose AVANT de prendre la ligne, et son absence marque
         un échec plutôt qu'un envoi.

         Le courrier part chez un fournisseur qui ne connaît ni nos clés ni nos
         traductions : lui passer `titleKey` brut donnerait un objet
         « notification.event_reminder » et un corps en JSON. Ça part, et ça ne
         se lit pas.

         Une clé sans phrase est un trou de développement, pas une panne
         passagère. D'où `invalid` et non `failed` : réessayer n'y changerait
         rien tant que personne n'aura écrit la phrase. La distinction compte
         parce que `failed` appelle une intervention — mêler les deux ferait
         noyer les vraies pannes dans ce qui est structurellement impossible.
         La taire la laisserait `pending` pour toujours, et un silence ne se
         remarque pas. */
      const phrase = phraseDeNotification(n.titleKey, n.bodyParams, langue);
      if (phrase === null) {
        const prise = await this.prisma.notification.updateMany({
          where: { id: n.id, status: "pending" },
          data: { status: "invalid" },
        });
        if (prise.count === 0) continue;
        impossibles += 1;
        this.logger.warn(`aucune phrase pour ${n.titleKey} (${n.id}) en ${langue}`);
        continue;
      }

      /* Un `push` sans appareil ne peut pas aboutir, et on le DIT.
         La programmation ne pose une ligne `push` que si un appareil existe,
         mais l'application a pu être désinstallée depuis. Marquer `sent`
         prétendrait qu'elle est partie ; laisser `pending` ferait grossir une
         file qui ment sur ce qu'elle contient.
         `invalid` plutôt que `failed` : il n'y a rien à réparer et rien à
         réessayer — quelqu'un a simplement désinstallé l'application. */
      if (n.channel === "push" && n.user.devices.length === 0) {
        const prise = await this.prisma.notification.updateMany({
          where: { id: n.id, status: "pending" },
          data: { status: "invalid" },
        });
        if (prise.count === 0) continue;
        impossibles += 1;
        this.logger.warn(`aucun appareil actif pour ${n.type} (${n.id})`);
        continue;
      }

      /* On prend la ligne pour soi AVANT d'envoyer, et on ne la prend que si
         elle est encore en attente. Le `updateMany` avec la condition sur le
         statut est ce qui rend deux processus concurrents inoffensifs : le
         second ne trouve rien à mettre à jour, donc n'envoie pas. */
      const prise = await this.prisma.notification.updateMany({
        where: { id: n.id, status: "pending" },
        data: { status: "sent", sentAt: new Date() },
      });
      if (prise.count === 0) continue;

      try {
        if (n.channel === "push") {
          await this.push.envoyer({
            jetons: n.user.devices.map((d) => d.pushToken),
            titre: phrase.titre,
            corps: phrase.corps,
            /* La route voyage en données, pas dans le texte. C'est elle qui
               ouvre le bon écran quand on tape la notification : sans elle,
               taper ramène à l'accueil, et il faut retrouver soi-même ce dont
               on venait d'être prévenu. */
            ...(n.targetRoute ? { donnees: { route: n.targetRoute } } : {}),
          });
        } else {
          await this.mail.send({
            to: n.user.email,
            subject: phrase.titre,
            text: phrase.corps,
            // La langue se relit ICI, pas à la programmation : elle peut avoir
            // changé entre le moment où la notification a été posée et celui où
            // elle part. C'est la raison pour laquelle le serveur transporte une
            // clé jusqu'au dernier moment au lieu d'une phrase figée.
            locale: langue,
          });
        }
        envoyees += 1;
      } catch (err: unknown) {
        echouees += 1;
        await this.prisma.notification.update({
          where: { id: n.id },
          data: { status: "failed" },
        });
        /* Le journal ne porte PAS l'adresse — « le journal n'est pas une copie
           de la liste ». Le type et la cause suffisent à diagnostiquer ; qui
           l'a reçue se retrouve par l'identifiant. */
        this.logger.warn(
          `envoi ${n.type} échoué (${n.id}) : ${err instanceof Error ? err.message : "cause inconnue"}`,
        );
      }
    }

    if (envoyees > 0 || echouees > 0 || impossibles > 0) {
      this.logger.log(`${envoyees} envoyées, ${echouees} en échec, ${impossibles} impossibles`);
    }
    return { envoyees, echouees, impossibles };
  }
}
