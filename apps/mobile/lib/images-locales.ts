import * as FileSystem from "expo-file-system/legacy";
import { urlMediaRenduSchema } from "@lehno/contracts";
import { appel } from "./api.js";

/**
 * LES IMAGES SE GARDENT SUR L'APPAREIL.
 *
 * Une photo de profil ne change pas trois fois par jour, et la retélécharger à
 * chaque écran coûte du forfait pour rien. Elle doit aussi **paraître hors
 * connexion** : c'est la même promesse que le cache de lecture — « vos notes et
 * vos dates restent consultables ».
 *
 * **On range par CLÉ, jamais par URL.** L'URL est un laissez-passer signé : elle
 * change à chaque lecture, donc un cache indexé dessus ne reconnaît jamais deux
 * fois la même image. La clé, elle, ne bouge que quand l'image change — c'est ce
 * qui fait qu'on sait n'avoir rien à retélécharger, et qu'une image remplacée
 * remplace bien l'ancienne.
 *
 * La clé ne donne aucun accès par elle-même : il faut la présenter au serveur,
 * qui vérifie qu'elle nous appartient avant de signer.
 */
const DOSSIER = `${FileSystem.cacheDirectory ?? ""}images-lehno/`;

/* Une clé porte des barres obliques (`avatars/ab12…`) : elles feraient des
   sous-dossiers, dont un seul manquant fait échouer l'écriture. On les aplatit
   plutôt que de créer une arborescence qu'il faudrait ensuite entretenir. */
const nomLocal = (cle: string): string => `${DOSSIER}${cle.replace(/[^A-Za-z0-9._-]/g, "_")}`;

let dossierPret = false;

async function preparerLeDossier(): Promise<void> {
  if (dossierPret) return;
  const etat = await FileSystem.getInfoAsync(DOSSIER);
  if (!etat.exists) await FileSystem.makeDirectoryAsync(DOSSIER, { intermediates: true });
  dossierPret = true;
}

/**
 * Le fichier local d'une image, téléchargé si on ne l'a pas encore.
 *
 * Rend `null` quand l'image n'est pas là ET qu'on ne peut pas l'obtenir — hors
 * connexion sur une image jamais vue. L'écran affiche alors ce qu'il affiche
 * sans image : des initiales, un aplat. Il ne montre pas une erreur, parce que
 * ce n'en est pas une.
 */
export async function imageLocale(cle: string | null): Promise<string | null> {
  if (cle === null) return null;
  await preparerLeDossier();

  const chemin = nomLocal(cle);
  const deja = await FileSystem.getInfoAsync(chemin);
  /* PRÉSENT = SERVI, sans demander l'avis du réseau. C'est ce qui rend l'image
     visible hors connexion, et ce qui évite un aller-retour quand tout va bien :
     une clé désigne un contenu, et ce contenu ne change pas sous elle. */
  if (deja.exists) return chemin;

  try {
    const { url } = urlMediaRenduSchema.parse(
      await appel<unknown>("/me/media/url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cle }),
      }),
    );
    const recu = await FileSystem.downloadAsync(url, chemin);
    if (recu.status !== 200) {
      // Un téléchargement à moitié fait ne doit pas se prendre pour un cache.
      await FileSystem.deleteAsync(chemin, { idempotent: true });
      return null;
    }
    return chemin;
  } catch {
    return null;
  }
}

/**
 * Oublier ce qui ne sert plus.
 *
 * Appelée avec les clés ENCORE valables : tout le reste s'en va. C'est plus sûr
 * que d'effacer au moment où une image change — un écran qui oublierait de le
 * dire laisserait le fichier pour toujours, et le dossier grossirait sans que
 * personne ne s'en aperçoive.
 */
export async function oublierLesAutres(clesVivantes: (string | null)[]): Promise<void> {
  await preparerLeDossier();
  const gardees = new Set(
    clesVivantes.filter((c): c is string => c !== null).map((c) => nomLocal(c)),
  );
  try {
    for (const nom of await FileSystem.readDirectoryAsync(DOSSIER)) {
      const chemin = `${DOSSIER}${nom}`;
      if (!gardees.has(chemin)) await FileSystem.deleteAsync(chemin, { idempotent: true });
    }
  } catch {
    // Un ménage qui échoue ne casse rien : il se refera au prochain passage.
  }
}
