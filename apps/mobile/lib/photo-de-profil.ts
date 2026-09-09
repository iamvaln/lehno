import * as ImagePicker from "expo-image-picker";
import { depotAvatarSchema, profileSchema, type Profile } from "@lehno/contracts";
import { appel } from "./api.js";

/**
 * Changer sa photo de profil.
 *
 * **Le dépôt ne traverse pas l'API.** Le serveur signe une URL valable quelques
 * minutes, le téléphone dépose dessus, puis confirme. Une photo de deux
 * mégaoctets qui passerait par le serveur occuperait une connexion pour rien,
 * et sur un forfait lent elle la tiendrait longtemps.
 *
 * **La clé n'existe pas ici.** Le serveur l'engendre et la retient : nous
 * n'avons rien à nommer, et la confirmation ne porte aucun corps. C'est ce qui
 * empêche de pointer son avatar vers l'objet d'un autre.
 *
 * **On n'envoie pas l'original.** Le choix est déjà recadré au carré et borné
 * en largeur : ce n'est pas une garantie — le serveur revérifie tout et
 * recompose —, c'est une économie de forfait. Un original d'appareil fait
 * plusieurs mégaoctets pour une vignette de 512 pixels.
 */
export type ChoixPhoto = { uri: string; typeMime: string };

/** Ce que l'écran doit dire quand rien ne s'est passé. */
export type IssueChoix = "choisie" | "annulee" | "refusee";

export async function choisirUnePhoto(): Promise<
  { issue: "choisie"; photo: ChoixPhoto } | { issue: Exclude<IssueChoix, "choisie"> }
> {
  /* La permission se demande AU MOMENT du geste, jamais au démarrage : une
     application qui réclame l'accès aux photos avant qu'on ait rien demandé se
     fait refuser, et le refus est durable. */
  const droit = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!droit.granted) return { issue: "refusee" };

  const choix = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.85,
  });
  if (choix.canceled || choix.assets[0] === undefined) return { issue: "annulee" };

  const actif = choix.assets[0];
  return {
    issue: "choisie",
    photo: { uri: actif.uri, typeMime: actif.mimeType ?? "image/jpeg" },
  };
}

/**
 * Déposer, puis confirmer. Rend le profil à jour.
 *
 * Les deux temps sont séparés par le serveur, pas par nous : le dépôt réussi ne
 * change rien tant qu'il n'est pas confirmé, et c'est la confirmation qui relit
 * les octets, vérifie le type et recompose l'image.
 */
/* La montée elle-même, partagée : profil et souhait déposent pareil, et les
   deux bornes — la taille, le type — viennent du serveur. */
async function deposerLeFichier(
  photo: ChoixPhoto,
  depot: { url: string; typeMime: string; tailleMax: number },
): Promise<void> {
  const octets = await (await fetch(photo.uri)).blob();
  /* Refusé AVANT de monter : envoyer cinq mégaoctets pour se les faire refuser
     ensuite ferait payer le forfait deux fois. La borne vient du serveur, elle
     ne se recopie pas — une constante recopiée finit par diverger. */
  if (octets.size > depot.tailleMax) throw new Error("trop_lourde");

  /* Le dépôt part DIRECTEMENT sur le stockage : pas de jeton de session
     là-dedans, l'URL signée porte seule la permission. Et le type doit être
     celui pour lequel elle a été signée, sans quoi le stockage refuse. */
  const montee = await fetch(depot.url, {
    method: "PUT",
    headers: { "content-type": depot.typeMime },
    body: octets,
  });
  if (!montee.ok) throw new Error("depot_refuse");
}

export async function envoyerLaPhoto(photo: ChoixPhoto): Promise<Profile> {
  const depot = depotAvatarSchema.parse(await appel<unknown>("/me/profile/avatar/depot", {
    method: "POST",
  }));

  await deposerLeFichier(photo, depot);

  // Aucun corps : le serveur sait quelle clé il a délivrée, et à qui.
  return profileSchema.parse(await appel<unknown>("/me/profile/avatar", { method: "POST" }));
}

/**
 * La photo d'un souhait, par le MÊME chemin.
 *
 * Le serveur retient ce que le dépôt vise : la confirmation ne le dit pas, et
 * ne peut donc pas se tromper de souhait. Rien à rendre — l'écran relit sa
 * liste, qui portera la clé.
 */
export async function envoyerLaPhotoDuSouhait(
  souhaitId: string, photo: ChoixPhoto,
): Promise<void> {
  const depot = depotAvatarSchema.parse(
    await appel<unknown>(`/me/owner-wishes/${souhaitId}/photo/depot`, { method: "POST" }),
  );
  await deposerLeFichier(photo, depot);
  await appel<unknown>(`/me/owner-wishes/${souhaitId}/photo`, { method: "POST" });
}

export async function retirerLaPhoto(): Promise<Profile> {
  return profileSchema.parse(await appel<unknown>("/me/profile/avatar", { method: "DELETE" }));
}
