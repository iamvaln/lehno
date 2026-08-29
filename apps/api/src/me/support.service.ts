import { Inject, Injectable } from "@nestjs/common";
import type {
  CreateFeedbackInput, CreateSupportRequestInput, SupportRequest,
} from "@lehno/contracts";
import { PrismaService } from "../prisma/prisma.service.js";

/* Écrire à l'équipe, donner un avis — spec mobile §3.26, spec technique §5.9.
 *
 * Deux chemins voisins et volontairement distincts. Une demande d'ASSISTANCE
 * attend une réponse : elle porte un état (`open`, `answered`, `closed`) et
 * quelqu'un doit s'en occuper. Un AVIS n'attend rien : il se dépose et se
 * compte. Les fondre ferait ou bien attendre une réponse à un avis, ou bien
 * perdre une demande d'aide dans une pile de notes de satisfaction.
 */
@Injectable()
export class SupportService {
  // @Inject explicite : voir SecurityService, même contrainte esbuild/vitest.
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /* La version de l'application et la plateforme accompagnent le message
     (§3.26 : « pour éviter de les demander »). Elles sont DÉCLARÉES par le
     client et ne prouvent rien — ce sont des indices de diagnostic. On ne
     les recoupe pas avec les appareils enregistrés : quelqu'un qui écrit
     depuis un téléphone dont les notifications sont coupées a le droit d'être
     aidé. */
  async ecrire(userId: string, entree: CreateSupportRequestInput): Promise<SupportRequest> {
    const ligne = await this.prisma.supportRequest.create({
      data: {
        userId,
        subject: entree.subject ?? null,
        body: entree.body,
        appVersion: entree.appVersion ?? null,
        platform: entree.platform ?? null,
      },
      select: { id: true, subject: true, body: true, status: true, createdAt: true },
    });
    return {
      id: ligne.id,
      subject: ligne.subject,
      body: ligne.body,
      status: ligne.status,
      createdAt: ligne.createdAt.toISOString(),
    };
  }

  /* L'avis ne rend RIEN de ce qu'il a écrit, et c'est voulu : il n'y a pas
     d'écran où le relire, pas de fil de discussion, pas de réponse à
     attendre. Rendre l'objet créé inviterait à en construire un, et à
     promettre un suivi qui n'existe pas. */
  async donnerSonAvis(userId: string, entree: CreateFeedbackInput): Promise<void> {
    await this.prisma.feedback.create({
      data: {
        userId,
        rating: entree.rating ?? null,
        body: entree.body ?? null,
        appVersion: entree.appVersion ?? null,
      },
    });
  }
}
