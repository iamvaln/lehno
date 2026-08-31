import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { cle as fabriquerCle, extensionDe } from "./cle.js";
import type { Depot, Prefixe, StockagePort } from "./stockage.port.js";

/* Cloudflare R2 par le protocole S3.
 *
 * R2 en est compatible : le SDK standard suffit, et le jour où l'on change de
 * fournisseur, seul l'endpoint bouge. Une bibliothèque propriétaire aurait lié
 * la forme des URL au prestataire.
 *
 * `region: "auto"` — R2 n'a pas de régions, mais le SDK en exige une pour
 * signer. « auto » est la valeur que Cloudflare documente ; en omettre une fait
 * échouer la signature avec une erreur qui parle d'AWS.
 */

/** Le dépôt expire vite : c'est un geste, pas un droit qu'on garde. */
const DEPOT_SECONDES = 600;
/** La lecture aussi — le temps d'afficher, pas de partager. */
const LECTURE_SECONDES = 300;

export class StockageR2 implements StockagePort {
  private readonly client: S3Client;

  constructor(
    accountId: string,
    accessKeyId: string,
    secretAccessKey: string,
    private readonly bucket: string,
  ) {
    this.client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  /* Le dépôt se fait SANS PASSER PAR LE SERVEUR.
   *
   * Un portrait de deux mégaoctets qui traverse l'API occupe une connexion pour
   * rien, et un reçu déposé depuis un téléphone en zone lente la tiendrait
   * longtemps — pendant tout ce temps, un ouvrier de moins pour tout le monde.
   *
   * Le type est FIGÉ dans la signature : l'URL ne vaut que pour lui. Sans ça,
   * on obtiendrait une URL en annonçant une image et y déposerait un exécutable.
   */
  async deposer(prefixe: Prefixe, typeMime: string): Promise<Depot> {
    const c = fabriquerCle(prefixe, extensionDe(typeMime));
    const url = await getSignedUrl(
      this.client,
      new PutObjectCommand({ Bucket: this.bucket, Key: c, ContentType: typeMime }),
      { expiresIn: DEPOT_SECONDES },
    );
    return { cle: c, url, expireDans: DEPOT_SECONDES };
  }

  /* Aucun compartiment public : le serveur signe chaque lecture, et décide à
     ce moment-là si celui qui demande a le droit. Un seau ouvert ferait de
     chaque lien partagé une fois un lien ouvert pour toujours. */
  lire(cle: string, secondes = LECTURE_SECONDES): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: cle }),
      { expiresIn: secondes },
    );
  }

  async ecrire(prefixe: Prefixe, contenu: Buffer, typeMime: string): Promise<string> {
    const c = fabriquerCle(prefixe, extensionDe(typeMime));
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket, Key: c, Body: contenu, ContentType: typeMime,
    }));
    return c;
  }

  async effacer(cle: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: cle }));
  }
}
