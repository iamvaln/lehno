import * as SecureStore from "expo-secure-store";
import type { Session } from "@lehno/contracts";

/* Les deux jetons de la session, au trousseau de l'appareil.
 *
 * Pas dans AsyncStorage : il écrit en clair dans le bac à sable de
 * l'application, et un jeton de rafraîchissement lisible est un compte pris.
 * SecureStore passe par le trousseau iOS et le keystore Android, où la clé ne
 * sort pas du matériel.
 *
 * Le jeton d'accès y va aussi, bien qu'il expire vite : le garder en mémoire
 * seule obligerait à redemander un code après chaque fermeture de
 * l'application, ce qui n'est pas ce qu'on promet.
 */

const ACCES = "lehno.acces";
const RAFRAICHISSEMENT = "lehno.rafraichissement";

export interface Jetons {
  acces: string;
  rafraichissement: string;
}

export async function poseLesJetons(session: Session): Promise<void> {
  await SecureStore.setItemAsync(ACCES, session.accessToken);
  await SecureStore.setItemAsync(RAFRAICHISSEMENT, session.refreshToken);
}

export async function litLesJetons(): Promise<Jetons | null> {
  const [acces, rafraichissement] = await Promise.all([
    SecureStore.getItemAsync(ACCES),
    SecureStore.getItemAsync(RAFRAICHISSEMENT),
  ]);
  // Un seul des deux ne sert à rien : sans rafraîchissement on ne peut pas
  // renouveler, sans accès on ne peut rien demander. La paire ou rien.
  if (!acces || !rafraichissement) return null;
  return { acces, rafraichissement };
}

export async function effaceLesJetons(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCES),
    SecureStore.deleteItemAsync(RAFRAICHISSEMENT),
  ]);
}
