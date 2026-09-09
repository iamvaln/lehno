import { Inject, Injectable } from "@nestjs/common";
import { TYPES_DE_RECU, type DepotRecu, type UrlMedia } from "@lehno/contracts";
import { PrismaService } from "../prisma/prisma.service.js";
import { AppError } from "../common/errors.js";
import type { StockagePort } from "../stockage/stockage.port.js";

/* `sharp` se charge À LA DEMANDE — même raison que dans AvatarService : c'est
 * une bibliothèque native, et une importation en tête de fichier lierait le
 * DÉMARRAGE de l'API à sa présence. Personne ne pourrait plus se connecter
 * parce qu'un reçu ne sait pas se redimensionner. */
type Sharp = (typeof import("sharp"))["default"];
let outil: Sharp | null = null;

async function image(): Promise<Sharp> {
  if (outil !== null) return outil;
  try {
    outil = (await import("sharp")).default;
    return outil;
  } catch {
    throw new AppError("internal_error", "image processing unavailable");
  }
}

/* La liste vient du CONTRAT, elle n'est pas recopiée ici : deux déclarations
   finiraient par diverger, et le jour où l'une accepterait un type que l'autre
   refuse, le dépôt serait signé pour un fichier que la confirmation rejette. */
export type TypeDeRecu = (typeof TYPES_DE_RECU)[number];

/* Cinq mégaoctets, la même borne que la photo de profil. Servie au client pour
   qu'il n'ait pas à recopier la règle : une constante recopiée finit par
   diverger, et c'est celle du serveur qui compte. */
const TAILLE_MAX = 5 * 1024 * 1024;

/* LE RECU NE SE RECADRE PAS, et c'est la différence qui compte avec un avatar.
 *
 * `AvatarService` recadre en carré, au centre : un visage vaut mieux cadré
 * serré. Appliqué à un reçu, ce recadrage couperait précisément ce qu'on vient
 * y chercher — la référence de transaction, souvent en haut ou en bas de
 * l'écran. On borne donc le plus grand côté et on garde la page entière.
 *
 * 2000 points : de quoi relire un montant et une référence sur une capture de
 * téléphone, sans ranger l'original d'un appareil photo. */
const COTE_MAX = 2000;

/* Les formats d'image acceptés, lus dans le CONTENU et non dans l'extension ni
   dans le `Content-Type` — les deux se déclarent, et un fichier se déclare comme
   il veut. */
const FORMATS = new Set(["jpeg", "png", "webp", "heif", "avif"]);

/* Dix minutes pour une lecture : le temps de télécharger sur un réseau lent,
   sans qu'un lien recopié survive à la séance. */
const DUREE_LECTURE = 600;

/**
 * Le reçu d'un versement, déposé EN DIRECT sur le stockage.
 *
 * IL COMPLÈTE LA RÉFÉRENCE, IL NE LA REMPLACE PAS. La référence reste
 * obligatoire : c'est elle qui rend le rapprochement exact, et une capture
 * d'écran ne prouve rien par elle-même. Le reçu, lui, aide l'administration à
 * trancher quand la référence a été mal recopiée ou que le montant ne tombe
 * pas juste.
 *
 * IL EST DONC FACULTATIF, et le moment où on le dépose n'est pas celui de la
 * déclaration : la personne a déjà versé son argent quand elle déclare. Exiger
 * le fichier à cet instant la laisserait coincée, argent parti, si son dépôt
 * échoue — réseau, fichier trop lourd, format refusé. On déclare d'abord, on
 * joint ensuite.
 *
 * TANT QUE LE PAIEMENT EST EN ATTENTE, et pas après : une fois la décision
 * prise, changer la pièce qui l'a motivée récrirait l'histoire.
 */
@Injectable()
export class RecuService {
  // @Inject explicites : esbuild/vitest n'émet pas design:paramtypes.
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject("STOCKAGE") private readonly stockage: StockagePort,
  ) {}

  /* Le paiement doit être À LUI et EN ATTENTE, et on le vérifie AU DÉPÔT plutôt
     qu'à la confirmation : refuser après une montée ferait payer le forfait
     pour rien.
     404 et non 403 — dire « ce paiement existe mais n'est pas à vous »
     apprendrait qu'il existe. */
  private async sienEtEnAttente(userId: string, paymentId: string): Promise<void> {
    const ligne = await this.prisma.payment.findFirst({
      where: { id: paymentId, userId },
      select: { status: true },
    });
    if (!ligne) throw new AppError("not_found", "resource not found");
    if (ligne.status !== "pending")
      throw new AppError("conflict", "this payment is no longer pending");
  }

  async depot(userId: string, paymentId: string, typeMime: TypeDeRecu): Promise<DepotRecu> {
    await this.sienEtEnAttente(userId, paymentId);

    const { cle, url, expireDans } = await this.stockage.deposer("recus", typeMime);
    /* LA CIBLE EST RETENUE PAR LE SERVEUR au moment de signer. La confirmation
       ne dira pas ce qu'elle vise — l'accepter du client permettrait de
       rattacher son reçu au paiement de quelqu'un d'autre.
       Le préfixe `recu:` la distingue de `avatar`, `souhait:` et `carnet:` :
       les identifiants se ressemblent, et une cible commune laisserait un
       fichier déposé pour l'un se rattacher à l'autre. */
    await this.prisma.user.update({
      where: { id: userId },
      data: { depotEnCoursKey: cle, depotEnCoursCible: `recu:${paymentId}` },
    });
    return { url, expireDans, typeMime, tailleMax: TAILLE_MAX };
  }

  /**
   * Confirmer : relire, vérifier, ranger, rattacher.
   *
   * Aucun corps de requête. Le serveur sait quelle clé il a délivrée, à qui, et
   * pour quel paiement ; le client dit seulement « c'est déposé ».
   */
  async confirmer(userId: string, paymentId: string): Promise<void> {
    await this.sienEtEnAttente(userId, paymentId);

    const compte = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { depotEnCoursKey: true, depotEnCoursCible: true },
    });
    if (compte.depotEnCoursKey === null || compte.depotEnCoursCible === null)
      throw new AppError("not_found", "no pending upload");
    if (compte.depotEnCoursCible !== `recu:${paymentId}`)
      throw new AppError("conflict", "pending upload targets something else");

    const octets = await this.stockage.contenu(compte.depotEnCoursKey);
    if (octets.byteLength > TAILLE_MAX) {
      await this.oublier(userId, compte.depotEnCoursKey);
      throw new AppError("validation_failed", "file too large");
    }

    const { propre, type } = await this.verifier(octets, userId, compte.depotEnCoursKey);
    const cle = await this.stockage.ecrire("recus", propre, type);

    const avant = await this.prisma.payment.findUniqueOrThrow({
      where: { id: paymentId }, select: { proofKey: true },
    });
    await this.prisma.payment.update({ where: { id: paymentId }, data: { proofKey: cle } });
    await this.prisma.user.update({
      where: { id: userId },
      data: { depotEnCoursKey: null, depotEnCoursCible: null },
    });
    await this.balayer([compte.depotEnCoursKey, avant.proofKey]);
  }

  /* CE QU'ON FAIT DES OCTETS, et les deux natures ne se traitent pas pareil.
   *
   * UNE IMAGE SE RECOMPOSE. Une photo de reçu prise au téléphone porte les
   * mêmes métadonnées qu'une autre — dont la position géographique, c'est-à-dire
   * l'adresse du domicile de quelqu'un qui vient d'acheter des crédits. Elle
   * repasse donc par sharp, qui n'en recopie aucune. On borne le plus grand côté
   * SANS recadrer : le recadrage carré d'un avatar couperait la référence de
   * transaction, qui est précisément ce qu'on vient lire.
   *
   * UN PDF NE SE RECOMPOSE PAS. On ne peut donc que vérifier qu'il en est un —
   * par ses octets d'en-tête, pas par ce qu'il déclare — et le ranger tel quel.
   * C'est un fichier qu'on n'a pas réécrit, et il faut le savoir : il n'est
   * jamais affiché en ligne, seulement servi en téléchargement, et lu par une
   * poignée d'administrateurs. Le refuser reviendrait à écarter le relevé que
   * les banques envoient par courriel, qui est la meilleure pièce qu'on puisse
   * recevoir.
   */
  private async verifier(
    octets: Buffer, userId: string, enAttente: string,
  ): Promise<{ propre: Buffer; type: TypeDeRecu }> {
    // `%PDF-`, les cinq octets que la spécification impose en tête de fichier.
    if (octets.subarray(0, 5).toString("latin1") === "%PDF-") {
      return { propre: octets, type: "application/pdf" };
    }

    try {
      const sharp = await image();
      const entree = sharp(octets, { failOn: "error" });
      const { format } = await entree.metadata();
      if (format === undefined || !FORMATS.has(format))
        throw new AppError("validation_failed", "unsupported file format");

      /* `.rotate()` applique l'orientation EXIF avant qu'on jette les
         métadonnées : sans lui, un reçu photographié en portrait se rangerait
         couché, et l'administrateur lirait de travers.
         `withoutEnlargement` : un petit reçu ne se gonfle pas — l'agrandir ne
         rendrait rien de plus lisible et ne ferait que du poids. */
      const propre = await entree
        .rotate()
        .resize(COTE_MAX, COTE_MAX, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();
      return { propre, type: "image/jpeg" };
    } catch (echec) {
      /* UNE PANNE DE CHEZ NOUS NE DÉTRUIT PAS LE DÉPÔT : l'outil manquant est
         notre affaire, pas celle de qui vient de monter son reçu. Un fichier
         refusé, lui, s'oublie — le garder ferait reprendre à la confirmation
         suivante un objet qu'on vient de rejeter. */
      if (echec instanceof AppError && echec.code === "internal_error") throw echec;
      await this.oublier(userId, enAttente);
      if (echec instanceof AppError) throw echec;
      throw new AppError("validation_failed", "not a readable receipt");
    }
  }

  /**
   * Une URL de lecture pour le reçu d'un paiement.
   *
   * ELLE VÉRIFIE LE DEMANDEUR À CHAQUE LECTURE. La clé seule ne vaut rien : un
   * seau ouvert ferait de chaque lien partagé une fois un lien ouvert pour
   * toujours.
   *
   * `pourAdmin` sépare les deux appelants au lieu d'un seul contrôle
   * permissif : un client ne lit que le sien, l'administration lit n'importe
   * lequel. Les fondre en « est-ce le sien OU un admin ? » ferait dépendre le
   * cloisonnement d'un booléen qu'un jour on oublierait de passer.
   */
  async urlDe(paymentId: string, demandeur: { userId: string } | { pourAdmin: true }): Promise<UrlMedia> {
    const ligne = await this.prisma.payment.findFirst({
      where: { id: paymentId, ...("userId" in demandeur ? { userId: demandeur.userId } : {}) },
      select: { proofKey: true },
    });
    // 404 et non 403 : dire « ce paiement existe mais n'est pas à vous »
    // apprendrait qu'il existe.
    if (!ligne || ligne.proofKey === null) throw new AppError("not_found", "resource not found");
    return {
      url: await this.stockage.lire(ligne.proofKey, DUREE_LECTURE),
      expireDans: DUREE_LECTURE,
    };
  }

  private async oublier(userId: string, cle: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { depotEnCoursKey: null, depotEnCoursCible: null },
    });
    await this.balayer([cle]);
  }

  /* Le ménage ne fait PAS échouer ce qui a réussi : le reçu est rattaché, la
     ligne est juste, et un objet oublié dans le compartiment coûte moins qu'une
     erreur rendue à quelqu'un dont le dépôt a abouti. */
  private async balayer(cles: readonly (string | null)[]): Promise<void> {
    for (const cle of cles) {
      if (cle === null) continue;
      try {
        await this.stockage.effacer(cle);
      } catch {
        // Volontairement muet : voir le commentaire ci-dessus.
      }
    }
  }
}
