import {
  ownerWishSchema, updateOwnerWishSchema, updateWishSchema,
  type OwnerWish, type UpdateOwnerWishInput, type UpdateWishInput, type Wish,
} from "@lehno/contracts";
import { etatDuSouhait, nomDuReserveur } from "./souhaits.js";

/* Le DÉTAIL d'un souhait — §3.19.
 *
 * Deux fichiers pour les souhaits, et c'est voulu : `souhaits.ts` porte LA
 * LISTE de mes souhaits, celui-ci porte UN souhait ouvert en grand. Ils ne
 * couvrent pas la même chose — le détail sert AUSSI l'autre nature de souhait,
 * l'idée notée pour un proche, que la liste ne connaît pas.
 *
 * DEUX SOUHAITS DIFFÉRENTS, UN SEUL ÉCRAN. Le contrat les tient dans deux
 * fichiers « pour que la confusion ne puisse pas se faire à l'import », et il a
 * raison :
 *
 *   — `OwnerWish` est CE QUE JE DEMANDE. Sa raison d'être est d'être publiée :
 *     `isPublic` décide de ce que des visiteurs voient, et lui seul se réserve.
 *     Son vocabulaire est disponible / réservé / déjà offert.
 *
 *   — `Wish` est UNE IDÉE QUE J'AI NOTÉE POUR QUELQU'UN. Elle ne se publie
 *     nulle part : `isShortlisted` n'est qu'un repère personnel, « ce qui
 *     m'intéresse ». Son vocabulaire est à étudier / retenu / déjà offert, et
 *     l'interrupteur de visibilité n'a pas à exister sur elle.
 *
 * Confondre les deux publierait ce qu'un proche a confié en privé. C'est
 * pourquoi le GENRE se décide une seule fois — à l'ouverture, sur les
 * paramètres de route — et que tout en découle : le chemin lu, le chemin écrit,
 * les positions offertes, le drapeau qui garde l'écran.
 *
 * `SouhaitOuvert` NOUE LE GENRE À LA FORME. Porter les deux séparément
 * laisserait un écran lire `isPublic` sur une idée — champ qui n'y existe pas —
 * ou poser une réservation sur une nature qui ne se réserve pas ; l'union
 * discriminée le rend impossible à écrire plutôt qu'à relire.
 *
 * Motif habituel : `react-native` est typé Flow, que ni esbuild ni Vitest ne
 * lisent. Les décisions vivent donc ici, l'écran ne fait que les appliquer.
 */

export type GenreDeSouhait = "mien" | "idee";

export type SouhaitOuvert =
  | { genre: "mien"; souhait: OwnerWish }
  | { genre: "idee"; souhait: Wish };

/* Les champs que les deux natures partagent — ce que le détail affiche et
   retouche. Écrits en `Pick` du contrat plutôt qu'à la main : un champ renommé
   là-bas casse ici, au lieu de se taire. */
type ChampsCommuns = Pick<
  OwnerWish, "label" | "link" | "details" | "price" | "currency" | "status"
>;

/* Ce qu'il faut pour ALLER CHERCHER un souhait — et il en faut deux morceaux.
 *
 * Aucune route ne sert un souhait seul : ni `GET /me/owner-wishes/{id}` ni
 * `GET /me/wishes/{id}` n'existent. On lit donc le CONTENANT — la liste, ou
 * l'occasion — et on y retrouve le souhait. `contenant` est cet identifiant-là.
 */
export interface CibleDuSouhait {
  genre: GenreDeSouhait;
  contenant: string;
  souhait: string;
}

/* L'UUID du contrat, emprunté plutôt que recopié : `ownerWishSchema.shape.id`
   EST la règle, et une expression rationnelle écrite ici en serait une seconde
   qui divergerait un jour. */
const estUnIdentifiant = (valeur: unknown): valeur is string =>
  ownerWishSchema.shape.id.safeParse(valeur).success;

/* CE QUE LA NAVIGATION APPORTE N'EST PAS DE CONFIANCE.
 *
 * Un lien profond pose ces paramètres ; ils partent ensuite dans un CHEMIN
 * d'API — `/me/wishlists/<ici>/wishes`. Un identifiant qui ne serait pas un
 * UUID sortirait de la ressource visée : `../../` y remonte, et l'application
 * irait interroger de sa propre autorité une route que personne n'a voulue.
 * On refuse donc tout ce qui n'est pas un identifiant, et l'écran affiche
 * « introuvable » — la seule réponse honnête à une adresse qu'on ne sait pas
 * lire.
 *
 * LES DEUX CONTENANTS ENSEMBLE SONT REFUSÉS, pas départagés par un ordre de
 * préférence. Ils ne mènent pas au même endroit et ne suivent pas le même
 * drapeau : trancher à la place de l'appelant ferait garder l'écran par le
 * mauvais drapeau, et une idée privée s'ouvrirait sous la règle des listes
 * publiques.
 */
export function cibleDuSouhait(params: {
  id?: unknown;
  liste?: unknown;
  occasion?: unknown;
}): CibleDuSouhait | null {
  const { id, liste, occasion } = params;
  if (!estUnIdentifiant(id)) return null;

  if (estUnIdentifiant(liste) && !estUnIdentifiant(occasion)) {
    return { genre: "mien", contenant: liste, souhait: id };
  }
  if (estUnIdentifiant(occasion) && !estUnIdentifiant(liste)) {
    return { genre: "idee", contenant: occasion, souhait: id };
  }
  return null;
}

/* LE DRAPEAU N'EST PAS LE MÊME SELON LE GENRE, et ce n'est pas un détail.
 *
 * `wishlist.own` ouvre MA liste partagée ; `wishlist` ouvre les souhaits notés
 * sur l'occasion d'un proche. Le serveur ferme déjà chacun de son côté par
 * `@Feature` : garder l'écran avec l'autre clé le laisserait s'ouvrir sur une
 * route fermée, qui rend 404 — l'écran paraîtrait cassé sur un compte sain. */
export function ecranDuSouhait(genre: GenreDeSouhait): "listes" | "souhait" {
  return genre === "mien" ? "listes" : "souhait";
}

/* Le contenant se LIT, le souhait s'ÉCRIT — et les deux chemins n'ont ni la
   même racine ni la même forme. Les composer ici évite qu'un écran mêle celui
   d'une nature au genre de l'autre. */
export function cheminDeLecture(cible: CibleDuSouhait): string {
  return cible.genre === "mien"
    ? `/me/wishlists/${cible.contenant}/wishes`
    : `/me/occurrences/${cible.contenant}/wishes`;
}

export function cheminDEcriture(cible: CibleDuSouhait): string {
  return cible.genre === "mien"
    ? `/me/owner-wishes/${cible.souhait}`
    : `/me/wishes/${cible.souhait}`;
}

/* Le souhait dans la réponse du contenant, ou rien.
 *
 * RIEN N'EST PAS UNE PANNE : un souhait retiré depuis un autre appareil, ou un
 * lien profond qui nomme un souhait d'une autre liste, laissent l'appel réussir
 * et la recherche échouer. L'écran le dit « introuvable » plutôt que d'afficher
 * une coquille aux champs vides, qu'on lirait comme un souhait sans titre. */
export function souhaitDeLaReponse<T extends { id: string }>(
  reponse: readonly T[],
  id: string,
): T | null {
  return reponse.find((s) => s.id === id) ?? null;
}

/* Le genre se NOUE à la forme au moment où le souhait entre dans l'écran, une
   fois, à l'endroit où l'on sait encore de quel chemin la réponse vient. Deux
   fonctions plutôt qu'une générique : la générique demanderait un type
   conditionnel que personne ne relit, pour économiser quatre lignes. */
export function ouvreLeMien(reponse: readonly OwnerWish[], id: string): SouhaitOuvert | null {
  const trouve = souhaitDeLaReponse(reponse, id);
  return trouve === null ? null : { genre: "mien", souhait: trouve };
}

export function ouvreLIdee(reponse: readonly Wish[], id: string): SouhaitOuvert | null {
  const trouve = souhaitDeLaReponse(reponse, id);
  return trouve === null ? null : { genre: "idee", souhait: trouve };
}

// ── Où en est ce souhait ────────────────────────────────────────────────────

export type Position = "disponible" | "reserve" | "etudier" | "retenu" | "offert";

/* UNE CASE QUI NE SE POSE PAS RESTE VISIBLE.
 *
 * `reglable: false` ne veut pas dire « à cacher ». « Réservé » est un état du
 * modèle : le montrer ailleurs et le taire ici laisserait croire disponible un
 * souhait que quelqu'un a déjà pris — et deux personnes achèteraient le même
 * cadeau. Il se LIT donc, et ne s'écrit pas.
 */
export interface CaseDePosition {
  cle: Position;
  active: boolean;
  reglable: boolean;
}

/* CE QUE LE PROPRIÉTAIRE PEUT ÉCRIRE : `available` et `fulfilled`, jamais
   `reserved`. Le contrat le refuse — « le laisser poser permettrait de déclarer
   pris un cadeau que personne n'a réservé, donc de le retirer de la liste
   partagée sans qu'aucune réservation ne l'explique ». */
const POSITIONS_MIENNES: readonly Position[] = ["disponible", "reserve", "offert"];

/* Une idée notée pour quelqu'un. La maquette en offre QUATRE — à étudier,
   retenu, ÉCARTÉ, déjà offert — et le contrat n'en porte que trois : `status`
   vaut available / reserved / fulfilled, `isShortlisted` est un booléen, et
   rien nulle part ne dit « écarté ». La quatrième case n'est donc pas ici : la
   poser ferait un bouton qui colore une pastille et n'enregistre rien, ce qui
   est pire qu'une case absente — on croirait avoir rangé l'idée, et elle
   reviendrait « à étudier » au prochain chargement. Signalé au serveur ; en
   attendant, une idée qu'on écarte se retire. */
const POSITIONS_DIDEE: readonly Position[] = ["etudier", "retenu", "offert"];

export function positionMienne(souhait: OwnerWish): Position {
  const etat = etatDuSouhait(souhait);
  return etat === "offert" ? "offert" : etat === "reserve" ? "reserve" : "disponible";
}

/* `fulfilled` PRIME SUR LE REPÈRE. Une idée déjà offerte reste souvent marquée
   « retenue » — c'est bien parce qu'on l'avait retenue qu'on l'a offerte. Lire
   le repère d'abord annoncerait donc « retenu » sur un cadeau déjà donné, et on
   le rachèterait. */
export function positionDeLIdee(souhait: Wish): Position {
  if (souhait.status === "fulfilled") return "offert";
  return souhait.isShortlisted ? "retenu" : "etudier";
}

export function positionCourante(ouvert: SouhaitOuvert): Position {
  return ouvert.genre === "mien"
    ? positionMienne(ouvert.souhait)
    : positionDeLIdee(ouvert.souhait);
}

export function positionsDuSouhait(ouvert: SouhaitOuvert): CaseDePosition[] {
  const courante = positionCourante(ouvert);
  const cases = ouvert.genre === "mien" ? POSITIONS_MIENNES : POSITIONS_DIDEE;
  // « Réservé » se lit et ne s'écrit pas ; le reste se pose.
  return cases.map((cle) => ({ cle, active: cle === courante, reglable: cle !== "reserve" }));
}

/* LE CORPS QUI POSE UNE POSITION — et il en dit plus qu'il n'y paraît.
 *
 * Revenir d'« offert » vers « à étudier » ne suffit pas à écrire le repère : il
 * faut AUSSI ramener le statut à `available`, sinon le souhait reste offert et
 * la pastille rebascule toute seule au premier rechargement. Les deux champs
 * partent donc ensemble, et l'écriture est idempotente — reposer la position
 * courante ne casse rien.
 *
 * On passe par le schéma plutôt que de rendre un objet nu : c'est le contrat
 * qui refuse `reserved`, et le lui faire dire ici garantit qu'aucun chemin ne
 * l'esquive. */
export function corpsDePosition(
  position: Position,
  genre: GenreDeSouhait,
): UpdateOwnerWishInput | UpdateWishInput {
  if (genre === "mien") {
    return updateOwnerWishSchema.parse({
      status: position === "offert" ? "fulfilled" : "available",
    });
  }
  if (position === "offert") return updateWishSchema.parse({ status: "fulfilled" });
  return updateWishSchema.parse({
    status: "available",
    isShortlisted: position === "retenu",
  });
}

/* QUI L'A RÉSERVÉ, quand on le sait — et seulement sur un souhait à moi.
 *
 * Le contrat est net : sur un souhait de proche, `reservedByName` est « toujours
 * nul aujourd'hui » et le serveur n'y pose jamais `reserved` — « une
 * `WishReservation` pointe un `OwnerWish`, jamais un `WishlistItem` ». Lire ce
 * champ sur une idée ne rendrait donc rien ; l'y afficher installerait une
 * phrase de réservation sur une nature qui ne se réserve pas. */
export function reservationDuSouhait(
  ouvert: SouhaitOuvert,
): { anonyme: true } | { anonyme: false; qui: string } | null {
  if (ouvert.genre !== "mien") return null;
  if (etatDuSouhait(ouvert.souhait) !== "reserve") return null;
  const qui = nomDuReserveur(ouvert.souhait);
  // Nul ne veut pas dire « personne n'a réservé » mais « aucun nom n'a été
  // donné » : une réservation muette reste une réservation.
  return qui === null ? { anonyme: true } : { anonyme: false, qui };
}

/* RETIRER UN SOUHAIT RÉSERVÉ EMPORTE LA RÉSERVATION, et quelqu'un attend
   peut-être de l'offrir. La confirmation le dit avant, pas après. */
export function retraitEmporteUneReservation(ouvert: SouhaitOuvert): boolean {
  return reservationDuSouhait(ouvert) !== null;
}

// ── Ce qui s'affiche ────────────────────────────────────────────────────────

/* CE QUE LE LIEN MONTRE : le domaine, pas l'adresse entière.
 *
 * « Où le trouver » répond à « chez qui », et une adresse de trois cents
 * caractères avec ses paramètres de suivi ne répond à rien — elle déborde,
 * s'enroule sur quatre lignes et pousse le reste de l'écran vers le bas.
 *
 * DÉCOUPÉ À LA MAIN, PAS PAR `new URL`. Hermes n'expose pas le même `URL` que
 * Node : `hostname` y a longtemps rendu une chaîne vide, et le test passerait
 * ici pendant que l'écran n'afficherait rien sur l'appareil. Un découpage de
 * chaîne dit la même chose des deux côtés. */
export function domaineDuLien(lien: string): string {
  const sansSchema = lien.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");
  const hote = sansSchema.split(/[/?#]/)[0] ?? "";
  // Ni l'authentification ni le port ne font partie du domaine.
  const sansIdentifiants = hote.slice(hote.lastIndexOf("@") + 1);
  const domaine = sansIdentifiants.split(":")[0]?.replace(/^www\./i, "") ?? "";
  // Une adresse qu'on ne sait pas découper se montre entière : illisible vaut
  // mieux qu'absente, puisque c'est le seul moyen de trouver l'objet.
  return domaine === "" ? lien : domaine;
}

/* CE QU'ON ACCEPTE D'OUVRIR AU-DEHORS.
 *
 * Le contrat n'exige qu'une URL, et `z.string().url()` accepte `javascript:` et
 * les autres schémas de l'appareil. Or ce lien vient du serveur, donc d'un champ
 * qu'un proche a pu remplir sur un formulaire de collecte : c'est une saisie
 * d'inconnu qui a fait un aller-retour, pas une donnée de confiance. On ne
 * remet donc à l'appareil que `http` et `https`. */
export function lienOuvrable(lien: string | null): string | null {
  if (lien === null) return null;
  return /^https?:\/\//i.test(lien) ? lien : null;
}

/* UN PRIX PORTE SA DEVISE, sans quoi il ne se lit pas : « 12 000 » ne dit ni
   des francs CFA ni des euros. Le contrat l'impose à l'écriture ; en lecture
   les deux champs sont nullables séparément, et un prix orphelin ne s'affiche
   pas plutôt que de s'afficher à moitié.

   LE REPLI N'EST PAS DÉCORATIF. Le contrat n'accepte que trois majuscules, pas
   la liste ISO : une devise inconnue traverse. Node l'imprime telle quelle —
   « 12 000 ZZZ » —, mais `Intl` n'est pas le même partout, et un moteur qui
   lève ferait tomber l'écran entier sur un champ d'affichage. On retombe alors
   sur le montant suivi du code : moins joli, jamais absent. */
export function prixAffichable(
  souhait: Pick<ChampsCommuns, "price" | "currency">,
  langue: string,
): string | null {
  const { price, currency } = souhait;
  if (price === null || currency === null) return null;
  try {
    return new Intl.NumberFormat(langue, {
      style: "currency", currency, maximumFractionDigits: 0,
    }).format(price);
  } catch {
    return `${price} ${currency}`;
  }
}

/* D'OÙ VIENT UNE IDÉE — et c'est le seul champ qui dise ce qu'elle vaut.
 *
 * `collected` a été dit par le proche lui-même, `accepted_idea` retenu d'une
 * génération, `owner` noté de sa propre main. Une table typée plutôt qu'une clé
 * construite à la volée : `Record<WishOrigin, …>` refuse de compiler tant
 * qu'une provenance ajoutée au contrat n'a pas son libellé, là où
 * `t["souhaitOrigine" + valeur]` afficherait « undefined ».
 *
 * Rien de tel sur un souhait à moi : je sais d'où vient ce que je demande. */
const ORIGINES: Record<Wish["origin"], "souhaitOrigineConfie" | "souhaitOrigineIdee" | "souhaitOrigine"> = {
  collected: "souhaitOrigineConfie",
  accepted_idea: "souhaitOrigineIdee",
  owner: "souhaitOrigine",
};

export function origineDeLIdee(
  ouvert: SouhaitOuvert,
): "souhaitOrigineConfie" | "souhaitOrigineIdee" | "souhaitOrigine" | null {
  return ouvert.genre === "mien" ? null : ORIGINES[ouvert.souhait.origin];
}

/* UN SOUHAIT DÉJÀ OFFERT NE SE RETOUCHE PLUS. Ni son prix ni son lien n'ont
   encore un sens à changer — les retoucher ferait revivre une ligne close. */
export function peutRetoucher(souhait: Pick<ChampsCommuns, "status">): boolean {
  return souhait.status !== "fulfilled";
}

// ── La retouche ─────────────────────────────────────────────────────────────

export interface SaisieDuSouhait {
  intitule: string;
  prix: string;
  devise: string;
  lien: string;
  details: string;
}

export function saisieDepuis(souhait: ChampsCommuns): SaisieDuSouhait {
  return {
    intitule: souhait.label,
    prix: souhait.price === null ? "" : String(souhait.price),
    // La devise reste celle du souhait ; à défaut, celle du produit.
    devise: souhait.currency ?? "XAF",
    lien: souhait.link ?? "",
    details: souhait.details ?? "",
  };
}

interface Retouche {
  label?: string;
  link?: string | null;
  details?: string | null;
  price?: number | null;
  currency?: string | null;
}

/* CE QUI A CHANGÉ, ET CELA SEUL.
 *
 * Le schéma est partiel — c'est une invitation à n'envoyer que le modifié, pas
 * une tolérance. Renvoyer tout écraserait ce qu'une autre session vient de
 * changer sur le même souhait.
 *
 * TROIS PIÈGES TIENNENT DANS CES QUINZE LIGNES :
 *
 * 1. Les champs facultatifs sont NULLABLES à la mise à jour, pas absents :
 *    vidé, un lien redevient nul. Une chaîne vide serait une adresse qui existe
 *    et ne mène nulle part — et le schéma la refuserait, puisqu'il attend une
 *    URL.
 *
 * 2. LA DEVISE PART AVEC LE PRIX, toujours. Le contrat refuse un prix sans
 *    devise ; n'envoyer que le montant parce que le code n'a pas bougé ferait
 *    rejeter l'enregistrement entier avec un message qui parle d'un champ que
 *    personne n'a touché.
 *
 * 3. Un prix illisible — « douze mille », « à voir » — n'est pas zéro. On le
 *    laisse alors tel qu'il était plutôt que d'écrire un montant que personne
 *    n'a saisi. Vider le champ, en revanche, EST une intention : le prix part.
 */
export function retoucheDuSouhait(
  saisie: SaisieDuSouhait,
  souhait: ChampsCommuns,
): Retouche {
  const corps: Retouche = {};

  const intitule = saisie.intitule.trim();
  if (intitule !== souhait.label && intitule !== "") corps.label = intitule;

  const lien = saisie.lien.trim();
  if (lien !== (souhait.link ?? "")) corps.link = lien === "" ? null : lien;

  const details = saisie.details.trim();
  if (details !== (souhait.details ?? "")) corps.details = details === "" ? null : details;

  const brut = saisie.prix.trim();
  const nombre = Number.parseFloat(brut.replace(",", "."));
  const lisible = brut !== "" && Number.isFinite(nombre) && nombre >= 0;
  const prix = brut === "" ? null : lisible ? nombre : souhait.price;
  if (prix !== souhait.price) {
    corps.price = prix;
    // Un prix vidé emmène sa devise ; un prix posé la redit.
    corps.currency = prix === null ? null : saisie.devise;
  }

  return corps;
}

/* LE CONTRAT REFUSE UN CORPS VIDE — « au moins un champ » —, et il a raison :
   un enregistrement qui n'écrit rien reviendrait en succès sans rien changer.
   Le bouton le dit avant l'aller-retour. Et un intitulé vidé n'est pas un
   souhait : la retouche l'ignore, donc il ne suffit jamais à enregistrer. */
export function peutEnregistrer(
  saisie: SaisieDuSouhait,
  souhait: ChampsCommuns,
): boolean {
  if (saisie.intitule.trim() === "") return false;
  return Object.keys(retoucheDuSouhait(saisie, souhait)).length > 0;
}

export function corpsDeRetouche(
  saisie: SaisieDuSouhait,
  ouvert: SouhaitOuvert,
): UpdateOwnerWishInput | UpdateWishInput {
  const corps = retoucheDuSouhait(saisie, ouvert.souhait);
  return ouvert.genre === "mien"
    ? updateOwnerWishSchema.parse(corps)
    : updateWishSchema.parse(corps);
}

/* Rendre un souhait privé, ou le remettre sur la liste partagée — et seulement
   sur un souhait à MOI. `isPublic` n'existe pas sur une idée : elle ne se
   publie nulle part, et l'interrupteur n'a pas à exister sur elle. */
export function corpsDeVisibilite(ouvert: SouhaitOuvert): UpdateOwnerWishInput | null {
  if (ouvert.genre !== "mien") return null;
  return updateOwnerWishSchema.parse({ isPublic: !ouvert.souhait.isPublic });
}
