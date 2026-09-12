import { Inject, Injectable, Logger } from "@nestjs/common";
import { photoReglageSchema, type PhotoReglage } from "@lehno/contracts";
import { PrismaService } from "../prisma/prisma.service.js";
import { AppError } from "../common/errors.js";
import { StudioConfigurationService } from "../studio/configuration.service.js";
import type { StockagePort } from "../stockage/stockage.port.js";

/* `sharp` se charge À LA DEMANDE — même raison que dans `AvatarService` et
 * `composition.ts` : c'est une bibliothèque native, et une importation en tête
 * de fichier lierait le DÉMARRAGE de l'API à sa présence. */
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

/* LA SOURCE RESTE, ET C'EST UNE DÉCISION DE PRODUIT.
 *
 * Une première version l'effaçait après chaque génération, sur la foi de la
 * spec — « après le traitement, la photo source est effacée ». C'était contre
 * l'usage : on refait un portrait pour en voir un autre, et redemander un
 * téléversement à chaque essai rendrait la recherche du bon rendu pénible.
 *
 * CONSÉQUENCE À TENIR : la clé de copie `studioPhotoAvis` dit encore « Elle
 * n'est pas conservée », dans les deux langues. Elle ne s'affiche nulle part —
 * l'écran du dépôt n'existe pas — mais elle est prête à partir. Elle doit être
 * réécrite avant, sans quoi l'application dira le contraire de ce que le serveur
 * fait. Promettre un effacement qu'on n'exécute pas rassure sans protéger.
 */

/* Les valeurs du code, quand aucune configuration n'est publiée ou que la
   sienne ne porte pas encore le bloc `photo`. Elles ne sont PAS un second jeu
   de réglages : ce sont celles que `reglagesPortraitDeDepart` sème, recopiées
   ici pour que le service tienne sans base. Les changer aux deux endroits est
   le piège ; le test compare les deux. */
const DEFAUTS: Omit<PhotoReglage, "consigne"> = {
  coteMin: 512,
  luminositeMin: 30,
  nettetteMin: 12,
};

/** La cible d'un dépôt de photo source, préfixée pour ne pas croiser les autres. */
const CIBLE = "portrait-source";

/**
 * LA PHOTO DONT ON S'INSPIRE — dépôt, jugement, effacement.
 *
 * ─── ELLE NE TRANSITE PAS PAR NOUS
 *
 * Le client téléverse DIRECTEMENT sur R2, par une URL signée, et nous dit
 * ensuite qu'il a fini. Faire passer quelques mégaoctets par l'API coûterait la
 * mémoire du processus à chaque dépôt, sur un serveur partagé — et pour rien,
 * puisque le stockage sait recevoir.
 *
 * ─── ON LA JUGE, ET ON DIT POURQUOI
 *
 * « Refusée avec une raison claire, plutôt que traitée mal » (spec portrait
 * §4.3). Trois refus, trois raisons, et chacune se règle au panneau : trop
 * petite, trop sombre, trop plate. Un modèle qui reçoit une photo illisible ne
 * refuse pas — il invente, et l'utilisateur paie une image qui n'a rien à voir.
 *
 * ─── ELLE S'EFFACE
 *
 * C'est ce que l'écran promet au moment du dépôt. Une promesse d'effacement qui
 * ne s'exécute pas est pire que pas de promesse : elle rassure sans protéger.
 * L'effacement a donc DEUX déclencheurs — le refus, tout de suite, et la fin de
 * la génération. Le préfixe `sources` n'existe que pour ça.
 */
@Injectable()
export class PhotoSourceService {
  private readonly logger = new Logger("photo-source");

  // @Inject explicites : esbuild/vitest n'émet pas design:paramtypes.
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(StudioConfigurationService) private readonly configs: StudioConfigurationService,
    @Inject("STOCKAGE_PORT") private readonly stockage: StockagePort,
  ) {}

  /** Ouvrir un dépôt : une URL signée, et la place gardée sur le compte. */
  async deposer(userId: string): Promise<{ url: string; expireDans: number; typeMime: string }> {
    const { cle, url, expireDans } = await this.stockage.deposer("sources", "image/jpeg");
    await this.prisma.user.update({
      where: { id: userId },
      data: { depotEnCoursKey: cle, depotEnCoursCible: CIBLE },
    });
    return { url, expireDans, typeMime: "image/jpeg" };
  }

  /**
   * Confirmer : on relit l'objet déposé et on le juge.
   *
   * LA CLÉ NE SORT PAS. Elle passe de `depotEnCoursKey` à `photoSourceKey`, et
   * le lancement ira l'y chercher. C'est la doctrine écrite sur
   * `depotAvatarSchema` : la donner au client permettrait de la remplacer par
   * celle d'un autre — un reçu de paiement, un export de données — et de nous
   * faire signer une lecture dessus. Le client n'a rien à en faire : il dit
   * « c'est déposé », et demande ensuite un portrait par la voie photo.
   *
   * UN REFUS EFFACE TOUT DE SUITE. Garder une photo qu'on vient de refuser
   * n'aurait aucun usage, et ce serait exactement le fichier qu'on ne veut pas
   * garder : celui d'un visage déposé par quelqu'un qui ne reviendra pas.
   */
  async confirmer(userId: string): Promise<void> {
    const compte = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { depotEnCoursKey: true, depotEnCoursCible: true },
    });
    if (compte.depotEnCoursKey === null || compte.depotEnCoursCible !== CIBLE)
      throw new AppError("conflict", "no photo deposit is pending");

    const cle = compte.depotEnCoursKey;
    const seuils = await this.seuils();

    let refus: string | null;
    try {
      refus = await this.juger(cle, seuils);
    } catch (err: unknown) {
      /* L'objet n'est pas lisible : le client a annoncé un dépôt qu'il n'a pas
         fait, ou le téléversement a été coupé. On efface la place gardée pour
         qu'un second essai reparte proprement. */
      await this.oublier(userId, cle);
      throw err instanceof AppError
        ? err
        : new AppError("validation_failed", "this photo could not be read");
    }

    if (refus !== null) {
      await this.oublier(userId, cle);
      /* LA RAISON VOYAGE DANS LE DÉTAIL, pas dans le message. L'écran a ses
         phrases — « trop sombre », « trop petite » — et les traduire ici les
         figerait en une langue. Le code suffit à choisir laquelle. */
      throw new AppError("validation_failed", "this photo cannot be used", { raison: refus });
    }

    /* LA PLACE DU DÉPÔT SE LIBÈRE, LA PHOTO PREND LA SIENNE. Le dépôt est
       consommé : un second `confirmer` sans nouveau téléversement doit refuser,
       sinon deux générations partiraient sur la même photo sans qu'on l'ait
       voulu.

       UNE PHOTO DÉJÀ EN ATTENTE EST REMPLACÉE, et l'ancienne effacée. C'est le
       geste naturel — on choisit une photo, puis on en choisit une autre — et
       la garder ferait vivre au stockage un fichier que plus rien ne désigne. */
    const ancienne = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId }, select: { photoSourceKey: true },
    });
    await this.prisma.user.update({
      where: { id: userId },
      data: { depotEnCoursKey: null, depotEnCoursCible: null, photoSourceKey: cle },
    });
    if (ancienne.photoSourceKey !== null) await this.effacer(ancienne.photoSourceKey);
  }

  /**
   * La photo acceptée d'un compte. ELLE RESTE.
   *
   * Elle se lisait et se libérait d'un même geste — une photo, une génération.
   * C'était faux pour le seul usage qui compte : ON REFAIT UN PORTRAIT POUR EN
   * VOIR UN AUTRE, et redemander un téléversement à chaque essai transformerait
   * la recherche du bon rendu en corvée. Elle reste donc en place, et les
   * relances repartent dessus.
   *
   * Elle est remplacée quand on en dépose une autre — `confirmer` efface alors
   * celle qui ne sert plus. C'est le seul moment où elle s'en va.
   */
  async lire(userId: string): Promise<string> {
    const compte = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId }, select: { photoSourceKey: true },
    });
    if (compte.photoSourceKey === null)
      throw new AppError("validation_failed", "no photo has been accepted for this portrait");
    return compte.photoSourceKey;
  }

  /**
   * Effacer une photo source devenue inutile.
   *
   * DEUX CAS SEULEMENT, et aucun n'est « après usage » : une photo qu'on vient
   * de refuser, et celle qu'un nouveau dépôt remplace. Dans les deux, plus rien
   * ne la désigne — la garder ferait vivre au stockage un fichier qu'aucun
   * portrait ne réclamera jamais.
   *
   * SILENCIEUX SUR L'ÉCHEC : le ménage ne doit pas faire échouer le geste qui
   * l'a déclenché. On le journalise, pour que la fuite se voie.
   */
  async effacer(cle: string): Promise<void> {
    try {
      await this.stockage.effacer(cle);
    } catch (err: unknown) {
      this.logger.error(`photo source non effacée (${cle}) : ${String(err)}`);
    }
  }

  /* LES SEUILS PUBLIÉS, ou ceux du code. On ne refuse pas quand rien n'est
     publié : la voie photo doit pouvoir s'éprouver sur un serveur neuf. */
  private async seuils(): Promise<Omit<PhotoReglage, "consigne">> {
    const publie = await this.configs.enService("portrait").catch(() => null);
    if (publie === null) return DEFAUTS;
    try {
      const { photo } = this.configs.reglagesPortraitDe(publie);
      if (photo === undefined) return DEFAUTS;
      const { consigne: _, ...reste } = photoReglageSchema.parse(photo);
      return reste;
    } catch {
      return DEFAUTS;
    }
  }

  /**
   * Le jugement. Rend le code du refus, ou `null` si la photo passe.
   *
   * L'ORDRE VA DU PLUS CERTAIN AU PLUS APPROCHÉ. La taille est un fait ; la
   * luminosité moyenne en est presque un ; la netteté est une approximation
   * (voir `photoReglageSchema`). Une photo petite ET floue doit s'entendre dire
   * « trop petite » — c'est le reproche qu'on peut corriger.
   */
  private async juger(
    cle: string, seuils: Omit<PhotoReglage, "consigne">,
  ): Promise<string | null> {
    const s = await image();
    const brut = await this.stockage.contenu(cle);
    const outil_ = s(brut);

    const { width, height } = await outil_.metadata();
    if (width === undefined || height === undefined)
      throw new AppError("validation_failed", "this photo could not be read");
    if (Math.min(width, height) < seuils.coteMin) return "trop_petite";

    /* `stats()` sur l'image APLATIE sur du noir : une photo à canal alpha
       rendrait une moyenne calculée sur des pixels transparents, donc un
       « trop sombre » qui ne dit rien de ce qu'on voit. */
    const stats = await s(await outil_.flatten({ background: "#000000" }).toBuffer()).stats();
    const canaux = stats.channels.slice(0, 3);
    const moyenne = canaux.reduce((t, c) => t + c.mean, 0) / canaux.length;
    if (moyenne < seuils.luminositeMin) return "trop_sombre";

    const ecartType = canaux.reduce((t, c) => t + c.stdev, 0) / canaux.length;
    if (ecartType < seuils.nettetteMin) return "trop_floue";

    return null;
  }

  /** Libérer la place ET effacer l'objet : un refus ne laisse rien derrière. */
  private async oublier(userId: string, cle: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { depotEnCoursKey: null, depotEnCoursCible: null },
    });
    await this.effacer(cle);
  }
}
