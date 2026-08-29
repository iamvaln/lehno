import { Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type { Submission, SubmissionDecisionInput } from "@lehno/contracts";
import { PrismaService } from "../prisma/prisma.service.js";
import { AppError } from "../common/errors.js";
import { echeances } from "../me/calendrier.js";

const ABSENT = (): AppError => new AppError("not_found", "resource not found");

// Un anniversaire se répète tous les ans : même règle que celle qu'EventService
// pose à la création. Elle est redite ici plutôt qu'importée parce que la
// validation écrit DANS une transaction — voir le commentaire de `decide`.
const TOUS_LES_ANS = { unite: "year" as const, pas: 1 };

type LigneSoumission = Prisma.SubmissionGetPayload<{
  include: { wishes: true; link: { select: { type: true; personId: true } } };
}>;

function rendre(s: LigneSoumission): Submission {
  return {
    id: s.id,
    linkType: s.link.type as Submission["linkType"],
    personId: s.link.personId,
    submitterName: s.submitterName,
    relationHint: s.relationHint,
    birthDate: s.birthDate?.toISOString().slice(0, 10) ?? null,
    personalNote: s.personalNote,
    status: s.status as Submission["status"],
    wishes: s.wishes.map((w) => ({
      id: w.id,
      label: w.label,
      link: w.link,
      price: w.price === null ? null : Number(w.price),
      currency: w.currency,
      reviewStatus: w.reviewStatus as "pending" | "retained" | "discarded",
    })),
    createdAt: s.createdAt.toISOString(),
  };
}

@Injectable()
export class SubmissionService {
  // @Inject explicite : voir WishService, même contrainte esbuild/vitest.
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private aujourdhui(): string {
    return new Date().toISOString().slice(0, 10);
  }

  async list(userId: string): Promise<Submission[]> {
    const lignes = await this.prisma.submission.findMany({
      where: { userId },
      include: { wishes: { orderBy: { createdAt: "asc" } }, link: { select: { type: true, personId: true } } },
      orderBy: { createdAt: "desc" },
    });
    return lignes.map(rendre);
  }

  async get(userId: string, id: string): Promise<Submission> {
    const ligne = await this.prisma.submission.findFirst({
      where: { id, userId },
      include: { wishes: { orderBy: { createdAt: "asc" } }, link: { select: { type: true, personId: true } } },
    });
    if (!ligne) throw ABSENT();
    return rendre(ligne);
  }

  /* LA DÉCISION, EN UNE SEULE TRANSACTION.
   *
   * §5.3 : « la décision porte sur l'ensemble : ce qu'on retient de la date, du
   * mot, et le sort de chaque souhait soumis. Le serveur applique la
   * répartition dans la fiche en une seule transaction. »
   *
   * En plusieurs écritures, une panne au milieu laisserait la date écrite, le
   * mot perdu, deux souhaits sur trois rangés — et la contribution marquée
   * validée par-dessus. Personne ne saurait ce qui manque : ni le propriétaire,
   * qui a vu son écran se fermer, ni le répondant, qui lit « retenu » sur un
   * souhait qui n'existe nulle part.
   *
   * Tout passe donc par `tx`, y compris les lectures de contrôle — et c'est
   * pourquoi ce service n'appelle NI EventService NI TenantRepository : les
   * deux écrivent par le client principal, hors de la transaction, et une
   * moitié du travail échapperait au retour en arrière.
   */
  async decide(userId: string, id: string, decision: SubmissionDecisionInput): Promise<Submission> {
    await this.prisma.$transaction(async (tx) => {
      const soumission = await tx.submission.findFirst({
        where: { id, userId },
        include: { wishes: true, link: { select: { type: true, personId: true } } },
      });
      if (!soumission) throw ABSENT();

      /* Une contribution ne se tranche QU'UNE FOIS. Sans cette garde, rejouer
         l'appel — un double appui, un client qui réessaie après un délai —
         rangerait les souhaits une seconde fois dans la fiche. Le conflit dit
         au client que le geste a déjà porté, sans rien réécrire. */
      if (soumission.status !== "pending") {
        throw new AppError("conflict", "this submission has already been reviewed");
      }

      if (decision.reject) {
        /* Le rejet en bloc emporte les souhaits encore en attente. Les laisser
           `pending` ferait lire au répondant « en cours d'examen » sur une
           contribution close depuis des mois. */
        await tx.submittedWish.updateMany({
          where: { submissionId: id, reviewStatus: "pending" },
          data: { reviewStatus: "discarded" },
        });
        await tx.submission.update({
          where: { id },
          data: { status: "rejected", reviewedAt: new Date() },
        });
        return;
      }

      /* CHAQUE souhait doit être tranché, aucun de plus.
       *
       * C'est la garde contre la validation à moitié faite : une contribution
       * close en laissant un souhait `pending` le laisserait invisible pour
       * toujours — il ne reparaîtrait dans aucune file, et le répondant lirait
       * indéfiniment « en cours d'examen ». */
      const attendus = new Set(soumission.wishes.map((w) => w.id));
      const tranches = decision.wishes ?? [];
      for (const w of tranches) {
        if (!attendus.delete(w.id)) {
          throw new AppError("validation_failed", "unknown submitted wish", {
            wishes: "one of these ids does not belong to this submission",
          });
        }
      }
      if (attendus.size > 0) {
        throw new AppError("validation_failed", "every submitted wish must be decided", {
          wishes: `${attendus.size} submitted wish(es) left undecided`,
        });
      }

      if (decision.keepBirthDate && !soumission.birthDate) {
        throw new AppError("validation_failed", "this submission carries no birth date", {
          keepBirthDate: "nothing to keep",
        });
      }
      if (decision.keepPersonalNote && !soumission.personalNote) {
        throw new AppError("validation_failed", "this submission carries no note", {
          keepPersonalNote: "nothing to keep",
        });
      }

      const personId = await this.ficheCible(tx, userId, soumission, decision);
      const retenus = tranches.filter((w) => w.reviewStatus === "retained");

      let occurrenceId: string | null = null;
      if (decision.keepBirthDate) {
        occurrenceId = await this.poserLaNaissance(
          tx, userId, personId, soumission.birthDate!.toISOString().slice(0, 10),
        );
      }

      if (retenus.length > 0) {
        /* Un souhait se range SUR UNE OCCASION — c'est l'occasion qui le porte,
           pas la fiche. Sans occasion, il n'y a nulle part où l'écrire : on
           refuse plutôt que d'en inventer une, et le message dit quoi faire. */
        occurrenceId ??= await this.occurrenceOuverte(tx, userId, personId);
        if (!occurrenceId) {
          throw new AppError("validation_failed", "this person has no occurrence to hold a wish", {
            wishes: "keep the birth date, or create an event on this person first",
          });
        }
        const auteur = await this.auteurDeclare(tx, soumission.submitterUsername);
        for (const w of retenus) {
          const source = soumission.wishes.find((s) => s.id === w.id)!;
          const cree = await tx.wishlistItem.create({
            data: {
              eventOccurrenceId: occurrenceId,
              // `collected` : ce souhait vient d'une contribution validée, pas
              // de la main du propriétaire. La provenance change ce que la
              // préparation en dit — elle ne se devine pas après coup.
              origin: "collected",
              authorUserId: auteur,
              label: source.label,
              link: source.link,
              price: source.price,
              currency: source.currency,
            },
            select: { id: true },
          });
          await tx.submittedWish.update({
            where: { id: w.id },
            // `wishlistItemId` rend la validation VÉRIFIABLE : sans lui, on ne
            // saurait pas dire ce qu'une décision a réellement écrit.
            data: { reviewStatus: "retained", wishlistItemId: cree.id },
          });
        }
      }

      const ecartes = tranches.filter((w) => w.reviewStatus === "discarded").map((w) => w.id);
      if (ecartes.length > 0) {
        /* On garde la ligne écartée plutôt que de l'effacer : c'est elle que le
           répondant relit à la réouverture de son lien. Effacée, son souhait
           disparaîtrait sans réponse — il croirait ne l'avoir jamais envoyé. */
        await tx.submittedWish.updateMany({
          where: { id: { in: ecartes } },
          data: { reviewStatus: "discarded" },
        });
      }

      if (decision.keepPersonalNote) {
        const note = await tx.note.create({
          data: {
            personId,
            // L'auteur déclaré, s'il a été reconnu : c'est ce qui distingue
            // « quelqu'un m'a dit » de « je l'ai noté moi-même ».
            authorUserId: await this.auteurDeclare(tx, soumission.submitterUsername),
            content: soumission.personalNote!,
          },
          select: { id: true },
        });
        /* Catégorie `facts` : le mot d'un proche dit quelque chose de la
           personne, pas une idée de cadeau. Le rattachement se fait en deux
           écritures plutôt qu'en création imbriquée — la même transaction les
           tient ensemble, et la forme imbriquée conditionnelle ne se type pas
           sous `exactOptionalPropertyTypes`.
           Silencieux si la catégorie manque : zéro ligne dans `note_category`
           est un état légitime (voir NoteService), et perdre le mot du
           répondant parce qu'un référentiel n'est pas amorcé serait pire. */
        const facts = await tx.category.findUnique({ where: { code: "facts" }, select: { id: true } });
        if (facts) {
          await tx.noteCategory.create({
            /* `auto` : c'est la règle de validation qui pose cette catégorie,
               personne ne l'a choisie. La marquer `user` attribuerait au
               propriétaire un classement qu'il n'a jamais fait. */
            data: { noteId: note.id, categoryId: facts.id, assignedBy: "auto" },
          });
        }
      }

      await tx.submission.update({
        where: { id },
        data: { status: "validated", reviewedAt: new Date() },
      });
    });

    return this.get(userId, id);
  }

  /* Où ranger la contribution.
   *
   * Un lien NOMINATIF porte déjà sa fiche : `personId` venu du client y serait
   * un détournement — on rangerait chez l'un ce qu'un autre a écrit —, et le
   * contrat le refuse déjà. Un lien PUBLIC ne vise personne : le propriétaire
   * désigne une fiche existante, ou une fiche neuve naît du nom du répondant.
   */
  private async ficheCible(
    tx: Prisma.TransactionClient,
    userId: string,
    soumission: LigneSoumission,
    decision: SubmissionDecisionInput,
  ): Promise<string> {
    if (soumission.link.type === "nominatif") {
      if (decision.personId && decision.personId !== soumission.link.personId) {
        throw new AppError("validation_failed", "a nominative link already carries its person", {
          personId: "not accepted on a nominative submission",
        });
      }
      // Le lien nominatif garantit `personId` non nul (contrat de création).
      return soumission.link.personId!;
    }

    if (decision.personId) {
      // Cloisonnement : la fiche désignée doit être au demandeur. Sans ce
      // filtre, un identifiant venu du client rangerait la contribution dans le
      // carnet d'un autre compte.
      const proche = await tx.person.findFirst({
        where: { id: decision.personId, userId },
        select: { id: true },
      });
      if (!proche) throw ABSENT();
      return proche.id;
    }

    const nom = soumission.submitterName?.trim();
    if (!nom) {
      /* Une fiche sans nom ne se crée pas : elle apparaîtrait vide dans
         l'annuaire, et personne ne saurait plus de qui elle parle. Le
         propriétaire désigne alors une fiche existante — c'est à quoi
         `personId` sert. */
      throw new AppError("validation_failed", "this contribution carries no name", {
        personId: "required: this public contribution has no submitter name to open a person with",
      });
    }
    const cree = await tx.person.create({
      data: {
        userId,
        displayName: nom,
        // « on se connaît d'où » se range dans le champ prévu pour la nuance,
        // pas dans l'énumération : « on a fait la fac ensemble » n'entre dans
        // aucune case, et l'écraser en `ami` perdrait ce que le répondant a dit.
        relationHint: soumission.relationHint,
      },
      select: { id: true },
    });
    return cree.id;
  }

  /* La date retenue devient la NAISSANCE du proche, puis son anniversaire.
   *
   * La naissance appartient à la personne — c'est un fait de son identité ;
   * l'anniversaire n'en est que la conséquence, la prochaine échéance annuelle.
   * On écrit donc les deux, et jamais la naissance seule : une fiche qui porte
   * une date sans événement n'apparaît dans aucune échéance, et l'utilisateur
   * croit sa validation perdue.
   *
   * Rend l'occurrence ouverte, qui servira à ranger les souhaits retenus.
   */
  private async poserLaNaissance(
    tx: Prisma.TransactionClient, userId: string, personId: string, naissance: string,
  ): Promise<string> {
    await tx.person.update({ where: { id: personId }, data: { birthDate: new Date(`${naissance}T00:00:00Z`) } });

    const [prochaine] = echeances(naissance, TOUS_LES_ANS, this.aujourdhui(), 1);
    const ancrage = new Date(`${prochaine!}T00:00:00Z`);

    // Un proche n'a qu'un anniversaire (§3.6) : s'il en porte déjà un, on
    // recale son ancrage plutôt que d'en créer un second — deux anniversaires
    // feraient partir les rappels en double.
    const existant = await tx.event.findFirst({
      where: { personId, kind: "birthday" },
      select: { id: true },
    });
    const eventId = existant
      ? (await tx.event.update({ where: { id: existant.id }, data: { referenceDate: ancrage }, select: { id: true } })).id
      : (await tx.event.create({
          data: {
            personId,
            authorUserId: userId,
            kind: "birthday",
            referenceDate: ancrage,
            schedules: { create: [{ type: "recurrent", unit: "year", interval: 1 }] },
          },
          select: { id: true },
        })).id;

    // `upsert` sur (eventId, occurrenceDate), qui est unique : recaler un
    // anniversaire déjà ouvert sur la même date ne doit pas échouer.
    const occurrence = await tx.eventOccurrence.upsert({
      where: { eventId_occurrenceDate: { eventId, occurrenceDate: ancrage } },
      create: { eventId, userId, occurrenceDate: ancrage, occurrenceYear: Number(prochaine!.slice(0, 4)) },
      update: {},
      select: { id: true },
    });
    return occurrence.id;
  }

  // L'occasion la plus proche à venir, tous types confondus : c'est celle que
  // le propriétaire prépare, donc celle où un souhait sert.
  private async occurrenceOuverte(
    tx: Prisma.TransactionClient, userId: string, personId: string,
  ): Promise<string | null> {
    const occurrence = await tx.eventOccurrence.findFirst({
      where: { userId, event: { personId }, status: "upcoming" },
      orderBy: { occurrenceDate: "asc" },
      select: { id: true },
    });
    return occurrence?.id ?? null;
  }

  /* Le pseudo auto-déclaré, résolu ICI et pas à l'arrivée.
   *
   * Il vient d'un formulaire sans connexion : n'importe qui peut écrire le
   * pseudo de n'importe qui. Le résoudre au dépôt ferait apparaître une
   * contribution SIGNÉE d'un compte qui ne l'a pas écrite ; résolu à la
   * validation, il ne s'applique qu'à ce que le propriétaire a lui-même
   * approuvé, sous ses yeux.
   *
   * Inconnu, il ne vaut rien : nul plutôt qu'une erreur — le répondant s'est
   * peut-être trompé d'une lettre, et sa contribution reste bonne.
   */
  private async auteurDeclare(tx: Prisma.TransactionClient, pseudo: string | null): Promise<string | null> {
    if (!pseudo) return null;
    const compte = await tx.user.findFirst({
      where: { username: pseudo, status: "active" },
      select: { id: true },
    });
    return compte?.id ?? null;
  }
}
