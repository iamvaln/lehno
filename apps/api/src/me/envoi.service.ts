import { Inject, Injectable, Logger } from "@nestjs/common";
import { phraseDeNotification, type Locale } from "@lehno/i18n";
import { PrismaService } from "../prisma/prisma.service.js";
import type { MailPort } from "../mail/mail.port.js";

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
  user: { email: string; uiLanguage: string };
};

@Injectable()
export class EnvoiService {
  private readonly logger = new Logger("envoi");

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject("MAIL_PORT") private readonly mail: MailPort,
  ) {}

  async envoyer(): Promise<{ envoyees: number; echouees: number }> {
    const dues = await this.prisma.notification.findMany({
      where: {
        status: "pending",
        channel: "email",
        // `scheduledFor` nul veut dire « tout de suite » : les relances
        // n'attendent pas une date, elles attendent le prochain passage.
        OR: [{ scheduledFor: null }, { scheduledFor: { lte: new Date() } }],
      },
      orderBy: { scheduledFor: "asc" },
      take: LOT,
      select: {
        id: true, type: true, channel: true, titleKey: true, bodyParams: true,
        user: { select: { email: true, uiLanguage: true } },
      },
    });

    let envoyees = 0;
    let echouees = 0;

    for (const n of dues as Ligne[]) {
      const langue = (n.user.uiLanguage === "en" ? "en" : "fr") as Locale;

      /* La phrase se compose AVANT de prendre la ligne, et son absence marque
         un échec plutôt qu'un envoi.

         Le courrier part chez un fournisseur qui ne connaît ni nos clés ni nos
         traductions : lui passer `titleKey` brut donnerait un objet
         « notification.event_reminder » et un corps en JSON. Ça part, et ça ne
         se lit pas.

         Une clé sans phrase est un trou de développement, pas une panne
         passagère — la marquer `failed` la fait paraître dans la file du
         back-office, là où quelqu'un la verra. La taire la laisserait
         `pending` pour toujours, et un silence ne se remarque pas. */
      const phrase = phraseDeNotification(n.titleKey, n.bodyParams, langue);
      if (phrase === null) {
        const prise = await this.prisma.notification.updateMany({
          where: { id: n.id, status: "pending" },
          data: { status: "failed" },
        });
        if (prise.count === 0) continue;
        echouees += 1;
        this.logger.warn(`aucune phrase pour ${n.titleKey} (${n.id}) en ${langue}`);
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

    if (envoyees > 0 || echouees > 0) {
      this.logger.log(`${envoyees} envoyées, ${echouees} en échec`);
    }
    return { envoyees, echouees };
  }
}
