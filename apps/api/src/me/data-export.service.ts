import { Inject, Injectable } from "@nestjs/common";
import { RAISON_DE_LA_SOURCE } from "@lehno/contracts";
import type { DataExportRequest } from "@lehno/contracts";
import { PrismaService } from "../prisma/prisma.service.js";
import { AppError } from "../common/errors.js";

/* L'export de ses données — spec mobile §3.11, spec technique §5.7, politique
 * de confidentialité §8 (droit à la portabilité).
 *
 * Deux moitiés bien distinctes. La DEMANDE, ici, s'enregistre et rend son
 * état. L'ASSEMBLAGE du document, plus bas, est une fonction sur laquelle
 * porte tout l'enjeu : c'est elle qui décide de ce qui sort du service, et le
 * fichier produit quitte notre garde pour de bon.
 */
@Injectable()
export class DataExportService {
  // @Inject explicite : voir SecurityService, même contrainte esbuild/vitest.
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private rendu(r: {
    id: string; status: string; createdAt: Date; completedAt: Date | null;
  }): DataExportRequest {
    return {
      id: r.id,
      status: r.status as DataExportRequest["status"],
      requestedAt: r.createdAt.toISOString(),
      completedAt: r.completedAt ? r.completedAt.toISOString() : null,
    };
  }

  /* UNE SEULE demande en cours à la fois.
   *
   * Un export lit l'intégralité du compte et produit un fichier : dix
   * demandes empilées par un client qui réessaie, c'est dix fois ce travail
   * pour un seul fichier utile. Le refus rend `conflict` plutôt que de
   * recréer silencieusement — l'écran doit pouvoir dire « votre export est
   * déjà en préparation » au lieu de laisser croire qu'il vient d'en relancer
   * un.
   */
  async demander(userId: string): Promise<DataExportRequest> {
    const enCours = await this.prisma.dataExportRequest.findFirst({
      where: { userId, status: "pending" },
      orderBy: { createdAt: "desc" },
    });
    if (enCours) throw new AppError("conflict", "an export is already being prepared");

    const ligne = await this.prisma.dataExportRequest.create({ data: { userId } });
    return this.rendu(ligne);
  }

  /* La dernière demande, ou rien. §3.11 dit que le fichier « part par e-mail
     quand il est prêt » — mais l'écran rouvert entre-temps doit pouvoir dire
     où en est la préparation, sinon la seule façon de le savoir est
     d'attendre le courrier. */
  async derniere(userId: string): Promise<DataExportRequest | null> {
    const ligne = await this.prisma.dataExportRequest.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    return ligne ? this.rendu(ligne) : null;
  }

  /* L'ASSEMBLAGE DU DOCUMENT.
   *
   * ────────────────────────────────────────────────────────────────────────
   * CE QUI NE SORT JAMAIS D'ICI, et pourquoi. À relire avant d'ajouter un
   * champ : ce fichier part chez la personne et échappe ensuite à toute
   * révocation. Une fuite ici ne se rattrape pas.
   *
   * 1. L'ADRESSE E-MAIL D'UN AUTRE COMPTE. Un parrain reçoit le PSEUDO de ses
   *    filleuls, jamais leur boîte — c'est déjà la règle du contrat de
   *    parrainage (« un parrain n'a pas à connaître la boîte de ses filleuls
   *    sous prétexte qu'il les a invités »). L'export ne peut pas être la
   *    porte de service par laquelle cette règle se contourne.
   *
   * 2. L'IDENTITÉ DE QUI A CONTRIBUÉ. Une note ou un souhait d'origine
   *    `collected` a été déposé par un proche via un lien de collecte. Son
   *    CONTENU appartient au carnet et sort — le propriétaire le lit déjà dans
   *    l'application. Le `authorUserId` qui le rattache à un compte, lui, ne
   *    sort pas : le contributeur a répondu à une invitation, il ne s'est pas
   *    inscrit sur une liste que quelqu'un emporte.
   *
   * 3. LES JETONS ET LES SECRETS. Jeton de notification (c'est une capacité
   *    d'envoi : qui l'obtient fait sonner le téléphone), condensés de codes,
   *    jetons de rafraîchissement, référence du prestataire de paiement,
   *    numéro mobile money en clair, clé d'un reçu déposé. Rien de tout cela
   *    n'est une donnée personnelle qu'on porte ailleurs ; ce sont des moyens
   *    d'agir sur le compte.
   *
   * 4. LES TRACES DE SÉCURITÉ. Connexions, adresses IP, agents utilisateurs.
   *    La spec technique §9.11 en fait des données d'investigation qui
   *    survivent au compte sous forme anonymisée ; §9.3 refuse déjà de les
   *    rendre à l'affichage. Un inventaire des sessions vivantes dans un
   *    fichier qui circule est par ailleurs une carte du compte.
   *
   * Ce qui SORT, en revanche, sort en entier : les notes du carnet parlent de
   * proches qui n'ont rien demandé, et c'est précisément pour ça qu'elles
   * appartiennent au carnet de celui qui les a écrites. Les lui retirer ne
   * protégerait personne — il les lit tous les jours dans l'application — et
   * lui rendrait un export mutilé au nom d'un tiers qu'il est seul à
   * connaître.
   * ────────────────────────────────────────────────────────────────────────
   */
  async assembler(userId: string): Promise<Record<string, unknown>> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, username: true, displayName: true, avatarUrl: true,
        referralCode: true, uiLanguage: true, theme: true, timezone: true,
        sendHour: true, digestFrequency: true, reminderLeadDays: true, gender: true,
        acceptedTermsAt: true, acceptedTermsVersion: true, createdAt: true,
      },
    });
    if (!user) throw new AppError("not_found", "no such account");

    const [proches, notes, evenements, souhaits, messages, credits, paiements,
      methodes, appareils, assistance, avis, filleuls] = await Promise.all([
      this.prisma.person.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
        select: {
          id: true, displayName: true, callingName: true, relation: true,
          relationHint: true, gender: true, city: true, country: true,
          birthDate: true, birthYearKnown: true, register: true, language: true,
          preferredChannel: true, isSelf: true, createdAt: true,
        },
      }),
      this.prisma.note.findMany({
        where: { person: { userId } },
        orderBy: { createdAt: "asc" },
        // `authorUserId` est ABSENT de cette sélection, et c'est le point 2
        // ci-dessus. `origin` suffit à dire qu'une note vient d'un proche
        // sans dire lequel.
        select: { id: true, personId: true, content: true, origin: true, createdAt: true },
      }),
      this.prisma.event.findMany({
        where: { person: { userId } },
        orderBy: { referenceDate: "asc" },
        select: {
          id: true, personId: true, label: true, kind: true, eventNature: true,
          referenceDate: true, createdAt: true,
          occurrences: { select: { occurrenceDate: true, status: true } },
        },
      }),
      this.prisma.wishlistItem.findMany({
        where: { occurrence: { userId } },
        orderBy: { createdAt: "asc" },
        // Ni `authorUserId` ici non plus.
        select: {
          id: true, label: true, details: true, link: true, price: true,
          currency: true, status: true, origin: true, isShortlisted: true, createdAt: true,
        },
      }),
      this.prisma.generatedMessage.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
        select: { id: true, content: true, shortContent: true, status: true, createdAt: true },
      }),
      this.prisma.creditTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
        select: { id: true, type: true, source: true, amount: true, createdAt: true },
      }),
      this.prisma.payment.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
        // Ni `providerRef`, ni `payerMsisdn`, ni `proofKey` : point 3.
        select: {
          id: true, direction: true, amount: true, currency: true, credits: true,
          status: true, feeAmount: true, createdAt: true,
        },
      }),
      this.prisma.paymentMethod.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
        // Ni `msisdn`, ni `providerRef`. `last4` est déjà la forme masquée que
        // l'application affiche (spec technique §9.11).
        select: {
          id: true, kind: true, brand: true, last4: true, expiresAt: true,
          lastUsedAt: true, firstSuccessfulPaymentAt: true, createdAt: true,
        },
      }),
      this.prisma.device.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
        // Pas de `pushToken` : point 3.
        select: { id: true, platform: true, appVersion: true, isActive: true, createdAt: true },
      }),
      this.prisma.supportRequest.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
        select: { id: true, subject: true, body: true, status: true, createdAt: true },
      }),
      this.prisma.feedback.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
        select: { id: true, rating: true, body: true, createdAt: true },
      }),
      this.prisma.referral.findMany({
        where: { referrerId: userId },
        orderBy: { createdAt: "asc" },
        // Le PSEUDO du filleul, jamais son adresse — point 1. La jointure ne
        // sélectionne que `username` : ainsi l'adresse n'est pas seulement
        // omise de la sortie, elle n'est jamais chargée en mémoire, donc pas
        // davantage dans un rapport d'incident qui capturerait cet objet.
        select: {
          status: true, createdAt: true,
          invitedUser: { select: { username: true } },
        },
      }),
    ]);

    const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);
    const jour = (d: Date | null): string | null => (d ? d.toISOString().slice(0, 10) : null);

    return {
      // La forme du document est versionnée : le jour où elle change, une
      // personne qui compare deux exports doit pouvoir savoir lequel elle lit.
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      account: {
        ...user,
        acceptedTermsAt: iso(user.acceptedTermsAt),
        createdAt: user.createdAt.toISOString(),
      },
      persons: proches.map((p) => ({
        ...p, birthDate: jour(p.birthDate), createdAt: p.createdAt.toISOString(),
      })),
      notes: notes.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() })),
      events: evenements.map((e) => ({
        ...e,
        referenceDate: jour(e.referenceDate),
        createdAt: e.createdAt.toISOString(),
        occurrences: e.occurrences.map((o) => ({
          occurrenceDate: jour(o.occurrenceDate), status: o.status,
        })),
      })),
      wishes: souhaits.map((w) => ({
        ...w,
        price: w.price === null ? null : Number(w.price),
        createdAt: w.createdAt.toISOString(),
      })),
      generatedMessages: messages.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() })),
      credits: credits.map((c) => ({
        id: c.id,
        type: c.type,
        // La RAISON dans le vocabulaire de la personne, jamais la source
        // comptable — même règle que l'écran des crédits. Un export n'est pas
        // l'endroit où lui apprendre notre plan comptable.
        reason: RAISON_DE_LA_SOURCE[c.source],
        amount: c.amount,
        createdAt: c.createdAt.toISOString(),
      })),
      payments: paiements.map((p) => ({
        ...p,
        amount: Number(p.amount),
        feeAmount: p.feeAmount === null ? null : Number(p.feeAmount),
        createdAt: p.createdAt.toISOString(),
      })),
      paymentMethods: methodes.map((m) => ({
        ...m,
        expiresAt: jour(m.expiresAt),
        lastUsedAt: iso(m.lastUsedAt),
        firstSuccessfulPaymentAt: iso(m.firstSuccessfulPaymentAt),
        createdAt: m.createdAt.toISOString(),
      })),
      devices: appareils.map((d) => ({ ...d, createdAt: d.createdAt.toISOString() })),
      supportRequests: assistance.map((s) => ({ ...s, createdAt: s.createdAt.toISOString() })),
      feedback: avis.map((f) => ({ ...f, createdAt: f.createdAt.toISOString() })),
      referrals: filleuls.map((r) => ({
        // Un filleul qui a supprimé son compte laisse une trace anonyme
        // (on delete set null) : on ne lui invente pas un nom.
        username: r.invitedUser?.username ?? null,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }
}
