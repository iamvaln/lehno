/**
 * Le code d'un refus, lu dans l'enveloppe plutôt que déduit du statut.
 *
 * **Un statut ne suffit pas à savoir ce qui s'est passé.** Le contrat range
 * plusieurs refus sous le même nombre — 422 est le défaut de toute règle métier
 * non satisfaite — et le nombre qu'on croit associé à un cas ne l'est parfois
 * pas du tout : le refus de fenêtre de vœux (`wish_window_closed`) n'a pas
 * d'entrée dans la table de `common/errors.ts`, donc il tombe sur **422**, là où
 * un client pressé écrirait 403.
 *
 * L'enveloppe, elle, porte le code exact (`packages/contracts/src/errors.ts`),
 * et c'est le seul contrat sur lequel une page peut s'appuyer.
 *
 * Rend `null` quand le corps n'est pas une enveloppe — une passerelle qui répond
 * du HTML, une coupure au milieu de la lecture. La page traite alors le refus
 * comme une panne, ce qu'il est de son point de vue.
 */
export async function codeDuRefus(reponse: Response): Promise<string | null> {
  try {
    const corps = await reponse.json() as { code?: unknown };
    return typeof corps?.code === "string" ? corps.code : null;
  } catch {
    return null;
  }
}
