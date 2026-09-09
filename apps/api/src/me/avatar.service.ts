import { Inject, Injectable, Logger } from "@nestjs/common";
import type { DepotAvatar, Profile } from "@lehno/contracts";
import { PrismaService } from "../prisma/prisma.service.js";
import { ProfileService } from "./profile.service.js";
import { AppError } from "../common/errors.js";
import type { StockagePort } from "../stockage/stockage.port.js";

/* `sharp` se charge À LA DEMANDE, et son absence ne fait pas tomber le serveur.
 *
 * C'est une bibliothèque NATIVE : elle tient à des binaires compilés pour la
 * plateforme, et l'image de production tourne sur Alpine (musl), pas sur ce
 * qu'on a sous la main en écrivant. Une importation en tête de fichier lie le
 * DÉMARRAGE de l'API à sa présence — et personne ne pourrait plus se connecter
 * parce qu'une photo de profil ne sait pas se redimensionner.
 *
 * Chargée ici, l'absence coûte ce qu'elle doit coûter : la confirmation d'une
 * photo refuse, en le disant. Tout le reste continue.
 */
type Sharp = (typeof import("sharp"))["default"];
let outil: Sharp | null = null;

async function image(): Promise<Sharp> {
  if (outil !== null) return outil;
  try {
    outil = (await import("sharp")).default;
    return outil;
  } catch {
    /* `internal_error`, et non `generation_unavailable` : celui-là dit qu'un
       fournisseur d'IA ne répond pas, ce qui serait mentir. Ici c'est le serveur
       qui ne sait pas faire ce qu'il devrait — 500, et c'est notre faute. */
    throw new AppError("internal_error", "image processing unavailable");
  }
}

/* Les bornes du dépôt.
 *
 * `TAILLE_MAX` est servie au client pour qu'il n'ait pas à recopier la règle —
 * une constante recopiée finit par diverger, et c'est celle du serveur qui
 * compte. Cinq mégaoctets : au-delà, ce n'est plus une photo de profil, c'est
 * un original d'appareil qu'on n'affichera jamais à cette taille.
 *
 * `COTE` est la taille servie. On recadre au centre : un visage vaut mieux
 * cadré serré que déformé, et l'appareil photo d'un téléphone ne rend jamais
 * un carré. */
const TAILLE_MAX = 5 * 1024 * 1024;
const COTE = 512;
const TYPE_DEPOT = "image/jpeg";

/* CE QU'ON ACCEPTE, lu dans le CONTENU et non dans l'extension ni dans le
   `Content-Type` — les deux se déclarent, et un fichier se déclare comme il
   veut. `sharp` lit l'en-tête réel du fichier. */
const FORMATS = new Set(["jpeg", "png", "webp", "heif", "avif"]);

/**
 * La photo de profil, déposée EN DIRECT sur le stockage.
 *
 * Une photo de deux mégaoctets qui traverse l'API occupe une connexion pour
 * rien, et un téléphone en zone lente la tiendrait longtemps. Le client dépose
 * donc lui-même, sur une URL signée pour quelques minutes.
 *
 * **Mais personne ne regarde plus les octets**, et c'est le prix du dépôt
 * direct. Le serveur relit donc l'objet à la confirmation : il vérifie le type
 * d'après le contenu, borne les dimensions, et **recompose l'image**. La
 * recomposition n'est pas un raffinement — c'est elle qui retire les
 * métadonnées, dont la POSITION GÉOGRAPHIQUE : une photo prise chez soi porte
 * l'adresse du domicile, et elle repartirait telle quelle vers quiconque voit
 * le profil.
 *
 * Les octets passent donc encore par nous, mais **hors du chemin de la
 * requête** : pas d'envoi multipart, pas de connexion tenue pendant la montée.
 */
@Injectable()
export class AvatarService {
  private readonly journal = new Logger(AvatarService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject("STOCKAGE_PORT") private readonly stockage: StockagePort,
    // Le profil se rend par le service qui le rend partout ailleurs : deux
    // façons de le composer finiraient par ne plus dire la même chose.
    @Inject(ProfileService) private readonly profils: ProfileService,
  ) {}

  /* Le client ne choisit RIEN. La clé est engendrée ici, retenue ici, et ne
     sort jamais : la lui donner permettrait de la remplacer par celle d'un
     autre — un reçu, un export — et de nous faire signer une lecture dessus. */
  async depot(userId: string): Promise<DepotAvatar> {
    const { cle, url, expireDans } = await this.stockage.deposer("avatars", TYPE_DEPOT);
    await this.prisma.user.update({
      where: { id: userId },
      data: { avatarPendingKey: cle },
    });
    return { url, expireDans, typeMime: TYPE_DEPOT, tailleMax: TAILLE_MAX };
  }

  /**
   * Confirmer : relire, vérifier, recomposer, poser.
   *
   * Aucun corps de requête. Le serveur sait quelle clé il a délivrée et à qui ;
   * le client dit seulement « c'est déposé ».
   */
  async confirmer(userId: string): Promise<Profile> {
    const compte = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { avatarPendingKey: true, avatarKey: true },
    });
    // Rien en attente : la confirmation ne suit aucun dépôt. On ne va pas
    // chercher au hasard dans le compartiment.
    if (compte.avatarPendingKey === null) throw new AppError("not_found", "no pending upload");

    const octets = await this.lireLeDepot(compte.avatarPendingKey);
    if (octets.byteLength > TAILLE_MAX) {
      await this.oublier(userId, compte.avatarPendingKey);
      throw new AppError("validation_failed", "image too large");
    }

    const propre = await this.recomposer(octets, userId, compte.avatarPendingKey);

    /* L'image recomposée s'écrit sous une clé NEUVE : celle du dépôt a été
       signée pour le client, qui peut y réécrire tant que l'URL vit. Garder la
       même laisserait remplacer l'image vérifiée par une autre, après coup. */
    const cle = await this.stockage.ecrire("avatars", propre, "image/jpeg");
    const ancienne = compte.avatarKey;

    await this.prisma.user.update({
      where: { id: userId },
      data: { avatarKey: cle, avatarPendingKey: null },
    });

    // Au mieux : un objet resté derrière ne doit pas faire échouer un
    // changement de photo déjà acquis.
    await this.balayer([compte.avatarPendingKey, ...(ancienne === null ? [] : [ancienne])]);

    return this.profils.get(userId);
  }

  async retirer(userId: string): Promise<Profile> {
    const compte = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { avatarKey: true, avatarPendingKey: true },
    });
    await this.prisma.user.update({
      where: { id: userId },
      data: { avatarKey: null, avatarPendingKey: null },
    });
    await this.balayer([compte.avatarKey, compte.avatarPendingKey]);
    return this.profils.get(userId);
  }

  // ── Les pièces ────────────────────────────────────────────────────────────

  /* Lu par le PORT, pas par une URL signée : le serveur a déjà les droits sur
     son propre compartiment, et signer une lecture pour se lire soi-même serait
     un aller-retour réseau pour rien. */
  private async lireLeDepot(cle: string): Promise<Buffer> {
    try {
      return await this.stockage.contenu(cle);
    } catch {
      /* Le client a demandé une URL puis n'a rien déposé. Ce n'est pas une
         panne, c'est une confirmation prématurée. */
      throw new AppError("not_found", "nothing was uploaded");
    }
  }

  private async recomposer(octets: Buffer, userId: string, enAttente: string): Promise<Buffer> {
    try {
      const sharp = await image();
      const entree = sharp(octets, { failOn: "error" });
      const { format } = await entree.metadata();
      if (format === undefined || !FORMATS.has(format)) {
        throw new AppError("validation_failed", "unsupported image format");
      }
      /* `.rotate()` AVANT le recadrage : sans lui, une photo prise en portrait
         se recadre à l'endroit où l'orientation EXIF disait le haut, et le
         visage sort du cadre. On lit l'orientation, on l'applique, puis on jette
         les métadonnées — sharp ne les recopie pas par défaut, et c'est
         justement ce qu'on veut. */
      return await entree
        .rotate()
        .resize(COTE, COTE, { fit: "cover", position: "attention" })
        .jpeg({ quality: 82 })
        .toBuffer();
    } catch (echec) {
      /* UNE PANNE DE CHEZ NOUS NE DÉTRUIT PAS LE DÉPÔT. L'outil manquant est
         notre affaire, pas celle de qui vient de monter sa photo : on laisse
         l'attente en place, et une confirmation plus tard aboutira. Un fichier
         refusé, lui, s'oublie — le garder ferait reprendre à la confirmation
         suivante un objet qu'on vient de rejeter. */
      if (echec instanceof AppError && echec.code === "internal_error") throw echec;
      await this.oublier(userId, enAttente);
      if (echec instanceof AppError) throw echec;
      // Un fichier qui n'est pas une image, ou qui ment sur ce qu'il est.
      throw new AppError("validation_failed", "not a readable image");
    }
  }

  private async oublier(userId: string, cle: string): Promise<void> {
    await this.prisma.user.update({ where: { id: userId }, data: { avatarPendingKey: null } });
    await this.balayer([cle]);
  }

  private async balayer(cles: (string | null)[]): Promise<void> {
    for (const cle of cles) {
      if (cle === null) continue;
      try {
        await this.stockage.effacer(cle);
      } catch (echec) {
        this.journal.warn(
          `objet non effacé (${cle}) : ${echec instanceof Error ? echec.message : "cause inconnue"}`,
        );
      }
    }
  }
}
