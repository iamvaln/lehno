/* Où joindre le serveur.
 *
 * « localhost » est le piège de tout développement mobile : depuis un émulateur
 * Android il désigne l'émulateur, depuis un téléphone il désigne le téléphone.
 * L'appel part, ne trouve rien, l'écran dit « la connexion n'a pas abouti » —
 * et on cherche du côté du serveur alors qu'il écoute très bien.
 *
 * En développement, l'API tourne sur la machine qui sert le bundle. Expo donne
 * son adresse : la reprendre est le seul moyen qui vaille pour un émulateur,
 * un simulateur et un vrai téléphone du même réseau, sans rien régler.
 */

export const PORT_DE_L_API = 3000;

export function adresseDeLApi(
  explicite: string | undefined,
  hoteDuBundle: string | undefined,
): string | null {
  // Une valeur posée à la main l'emporte : c'est ainsi qu'on vise une recette
  // ou un serveur distant depuis un poste de développement.
  if (explicite) return explicite;

  // `hostUri` porte l'hôte ET le port du serveur de développement — 8081 ou
  // 19000 selon les versions. Seul l'hôte nous intéresse.
  const hote = hoteDuBundle?.split(":")[0];
  if (hote) return `http://${hote}:${PORT_DE_L_API}`;

  /* Application empaquetée : pas de serveur de développement, donc rien à
     déduire. Retomber sur localhost y serait faux à coup sûr — mieux vaut
     échouer franchement qu'expédier une application qui s'appelle elle-même. */
  return null;
}
