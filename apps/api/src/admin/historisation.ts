import type { Prisma } from "@prisma/client";

/**
 * Pose l'auteur et le motif dans la transaction, à l'intention du déclencheur
 * qui historise les tables de configuration.
 *
 * `set_config(…, true)` plutôt que `SET LOCAL` : la portée est la même — la
 * transaction, et rien au-delà —, mais `SET LOCAL` n'accepte pas de paramètre.
 * Il faudrait concaténer, sur une chaîne que l'administrateur écrit lui-même.
 *
 * Sans cet appel, le déclencheur REFUSE l'écriture. C'est le but : une
 * configuration ne doit pas pouvoir changer sans raison, et l'oubli se
 * découvre au premier essai — pas deux ans plus tard, dans un historique
 * devenu illisible.
 */
export async function poserLAuteurEtLeMotif(
  tx: Prisma.TransactionClient,
  auteurId: string | null,
  motif: string,
): Promise<void> {
  await tx.$queryRaw`
    select set_config('app.actor_id', ${auteurId ?? ""}, true),
           set_config('app.reason', ${motif}, true)
  `;
}
