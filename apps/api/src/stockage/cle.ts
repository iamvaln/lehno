import { randomUUID } from "node:crypto";
import type { Prefixe } from "./stockage.port.js";

/* UNE CLÉ NE SE DEVINE PAS.
 *
 * Ni `portraits/{userId}/1.png`, ni un compteur : un identifiant tiré au sort.
 * Une clé qui se devine rend le compartiment public par déduction, même fermé —
 * il suffit d'essayer les numéros.
 *
 * L'identifiant du propriétaire n'y figure pas non plus, et c'est délibéré : il
 * ferait de la clé une donnée sur la personne, alors qu'elle voyage dans des
 * journaux et des URL. Le lien entre un fichier et son compte vit en base, où
 * il se protège.
 */
export function cle(prefixe: Prefixe, extension: string): string {
  const propre = extension.replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 8);
  return propre.length > 0 ? `${prefixe}/${randomUUID()}.${propre}` : `${prefixe}/${randomUUID()}`;
}

/* L'extension déduite du type déclaré, et RIEN d'autre.
 *
 * Pas le nom du fichier envoyé : il vient du client, il peut porter n'importe
 * quoi, et il finirait dans une clé qu'on sert ensuite. Un type inconnu ne
 * reçoit pas d'extension plutôt qu'une extension inventée. */
const EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "application/pdf": "pdf",
  "application/zip": "zip",
  "application/json": "json",
};

export function extensionDe(typeMime: string): string {
  return EXTENSIONS[typeMime.toLowerCase().split(";")[0]?.trim() ?? ""] ?? "";
}
