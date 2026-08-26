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

// Le port du serveur de développement. Il n'a rien d'universel : en recette
// comme en production, EXPO_PUBLIC_API_URL porte l'adresse entière.
export const PORT_DE_L_API = 3001;

function extraitLHote(source: string | undefined): string | null {
  if (!source) return null;
  const sansSchema = source.replace(/^[a-z]+:\/\//i, "");
  const hote = sansSchema.split("/")[0]?.split(":")[0];
  return hote || null;
}

export function adresseDeLApi(
  explicite: string | undefined,
  hoteDuBundle: string | undefined,
): string | null {
  // Une valeur posée à la main l'emporte : c'est ainsi qu'on vise une recette
  // ou un serveur distant depuis un poste de développement.
  if (explicite) return explicite;

  /* Deux formes possibles selon d'où vient l'information : « hôte:port », que
     donne Expo Go, ou l'adresse complète du bundle, que React Native expose et
     qui vaut aussi dans une application native. Seul l'hôte nous intéresse. */
  const hote = extraitLHote(hoteDuBundle);
  if (hote) return `http://${hote}:${PORT_DE_L_API}`;

  /* Application empaquetée : pas de serveur de développement, donc rien à
     déduire. Retomber sur localhost y serait faux à coup sûr — mieux vaut
     échouer franchement qu'expédier une application qui s'appelle elle-même. */
  return null;
}
