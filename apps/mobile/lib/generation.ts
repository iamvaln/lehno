import {
  estActive,
  type GenerationResult, type MessageStatus, type StartGenerationInput,
  type UpdateMessageInput,
} from "@lehno/contracts";

/* « Ce que Lehno a écrit » (§3.7), séparé de son affichage.
 *
 * Même motif que le carnet et la note : `react-native` est typé en Flow, et
 * aucun de nos outils de test ne sait le lire. Les décisions vivent donc ici,
 * où Vitest les charge, et l'écran ne fait que les appliquer.
 *
 * CE QUI SE DÉCIDE ICI, ET NULLE PART AILLEURS :
 *
 * — L'ATTENTE N'ENFERME PAS (décisions natives §6). La demande est PARTIE quand
 *   on arrive ici ; l'écran n'est qu'un observateur. Il n'existe donc aucune
 *   fonction qui compose une demande à l'ouverture — `ouverture()` ne sait
 *   former qu'une LECTURE. Le jour où quelqu'un voudra relancer au montage,
 *   il devra changer cette fonction, et le test le dira.
 *
 * — RIEN NE SE REPAIE. Le crédit est débité à la DEMANDE, pas à l'affichage :
 *   revenir sur une génération en cours ne la redemande pas. Seul un geste
 *   explicite — « Refaire », « Réessayer » — passe par `relanceDuMessage`.
 *
 * — LE MESSAGE, ET LUI SEUL. `generationResultSchema` ne porte qu'un
 *   `message` : les idées n'ont pas de résultat au contrat, et le portrait est
 *   une image qui vit en §3.22. C'est aussi ce que dit le chemin de lancement —
 *   « Seul le MESSAGE est ouvert au lancement ».
 *
 * — LA RELECTURE N'EST PAS SOUS LE DRAPEAU. Éteindre `generation.message`
 *   retire « Refaire », jamais l'ajustement ni la lecture : les mettre sous le
 *   même interrupteur ferait disparaître un contenu déjà payé. C'est pour cela
 *   que `correctionDuMessage` n'a pas de paramètre de drapeaux, et que seul
 *   `offreDeRefaire` en prend un.
 */

/* Ce qu'on forme et ce qu'on envoie, chemin et corps ensemble — le motif de
   `envoiDeLaNote`. L'écran n'a plus qu'à choisir le verbe. */
export interface Envoi {
  chemin: string;
  corps: UpdateMessageInput | StartGenerationInput;
}

// ── L'ouverture de l'écran ──────────────────────────────────────────────────

export type Ouverture =
  | { sorte: "observer"; chemin: string }
  | { sorte: "sans-objet" };

/* On arrive ici avec l'identifiant d'une génération DÉJÀ lancée.
 *
 * Sans identifiant, il n'y a rien à observer — et surtout rien à relancer :
 * ouvrir une génération pour se donner quelque chose à montrer débiterait un
 * crédit que personne n'a demandé. L'écran le dit et offre une sortie.
 */
export function ouverture(id: string | undefined): Ouverture {
  if (!id) return { sorte: "sans-objet" };
  return { sorte: "observer", chemin: `/me/generations/${id}` };
}

// ── Les deux moments du même écran ──────────────────────────────────────────

export type Phase = "chargement" | "attente" | "resultat" | "echec";

/* `running` tant que la production travaille, puis `succeeded` ou `failed`.
 *
 * LE CAS QUI PIÈGE : `succeeded` sans message. Le contrat dit le message nul
 * « tant que l'exécution n'a pas abouti », donc la combinaison ne devrait pas
 * exister — mais s'y fier ferait tourner la roue POUR TOUJOURS le jour où elle
 * arrive, et sans rien à quoi se raccrocher. On la traite pour ce qu'elle est :
 * il n'y a rien à lire, donc c'est un échec, même si le serveur dit le
 * contraire.
 */
export function phaseDuResultat(resultat: GenerationResult | null): Phase {
  if (!resultat) return "chargement";
  if (resultat.generation.status === "running") return "attente";
  if (resultat.generation.status === "succeeded" && resultat.message) return "resultat";
  return "echec";
}

/* « En cas d'échec, le crédit est rendu au solde. » — et c'est la première
   question de qui vient de voir échouer ce qu'il a payé.
 *
 * Seul `failed` le rend. Un `succeeded` sans contenu a bel et bien dépensé le
 * crédit : annoncer « votre crédit n'a pas été prélevé » y serait un mensonge,
 * et de ceux qu'on découvre sur son solde. */
export function creditRendu(resultat: GenerationResult): boolean {
  return resultat.generation.status === "failed";
}

// ── Le sondage ──────────────────────────────────────────────────────────────

/* « Une minute environ », dit l'écran. Deux secondes pour la première reprise —
   une génération courte se voit tout de suite —, puis on double jusqu'à huit.
   Un intervalle fixe et court ferait trente appels pour une attente d'une
   minute ; un intervalle fixe et long ferait patienter dix secondes devant un
   résultat déjà prêt. */
export const PREMIER_DELAI = 2_000;
export const DELAI_MAX = 8_000;

export function doitInterroger(statut: GenerationResult["generation"]["status"]): boolean {
  return statut === "running";
}

/* Le rang du prochain tour, jamais un délai nul : un `tours` négatif ou non
   fini — un compteur mal remis à zéro — donnerait `setTimeout(0)` en boucle,
   c'est-à-dire une rafale d'appels au serveur pour une attente qui se voulait
   patiente. On se replie sur le premier délai. */
export function delaiAvantLaProchaine(tours: number): number {
  const rang = Number.isFinite(tours) && tours > 0 ? Math.floor(tours) : 0;
  return Math.min(DELAI_MAX, PREMIER_DELAI * 2 ** rang);
}

// ── L'ajustement du texte ───────────────────────────────────────────────────

// La borne du contrat, redite ici pour que l'écran n'ait pas à charger un
// schéma zod juste pour éteindre un bouton. Le test l'ancre au schéma lui-même.
export const LIMITE_DU_MESSAGE = 4000;

/* Ce que le texte vaut vraiment : sans ses blancs. `updateMessageSchema`
   applique `trim()` avant de mesurer, donc trois espaces sont un texte vide. */
export function texteUtile(saisie: string): string {
  return saisie.trim();
}

/* CORRIGER N'EST PAS RÉVERSIBLE. « `edited` se pose à la première correction
 * et ne se retire plus » : envoyer un PATCH pour un texte identique marquerait
 * comme retouché un message auquel personne n'a touché, et fausserait
 * durablement la seule mesure qui dit si nos brouillons tiennent.
 *
 * D'où la comparaison au texte du SERVEUR, blancs compris de part et d'autre :
 * ajouter un retour à la ligne puis le retirer ne doit rien envoyer.
 */
export function peutEnregistrerLAjustement(saisie: string, original: string): boolean {
  const texte = texteUtile(saisie);
  return texte.length >= 1
    && texte.length <= LIMITE_DU_MESSAGE
    && texte !== texteUtile(original);
}

/* Le corps ne porte QUE `content`. `updateMessageSchema` est `strict()` et ses
   deux champs sont facultatifs : y glisser `markSent: false` serait accepté par
   le schéma et déclarerait quelque chose que l'utilisateur n'a pas dit. */
export function correctionDuMessage(
  messageId: string,
  saisie: string,
  original: string,
): Envoi | null {
  if (!peutEnregistrerLAjustement(saisie, original)) return null;
  return {
    chemin: `/me/messages/${messageId}`,
    corps: { content: texteUtile(saisie) },
  };
}

// ── L'envoi, qui est une affirmation ────────────────────────────────────────

/* Ce que rend la feuille de partage du téléphone. On le redit ici plutôt que
   d'importer `ShareAction` : ce module ne charge pas `react-native`. */
export type IssueDuPartage = "sharedAction" | "dismissedAction";

/* « `markSent` est DÉCLARATIF : l'application n'envoie rien elle-même. »
 *
 * DEUX GARDES, et chacune répare un défaut différent :
 *
 * — La feuille REFERMÉE sans rien choisir rend `dismissedAction` sur iOS. La
 *   traiter comme un envoi marquerait « envoyé » un message que personne n'a
 *   reçu — exactement la preuve d'envoi que le contrat refuse de simuler.
 *   (Android rend toujours `sharedAction` : là-bas on ne sait pas, et on croit
 *   l'utilisateur. C'est cohérent avec une déclaration.)
 *
 * — Déjà `sent` : « un message envoyé puis corrigé reste envoyé ». Le redire
 *   ne changerait rien et coûterait un aller-retour.
 */
export function marquageEnvoye(
  messageId: string,
  statut: MessageStatus,
  issue: IssueDuPartage,
): Envoi | null {
  if (issue !== "sharedAction") return null;
  if (statut === "sent") return null;
  return { chemin: `/me/messages/${messageId}`, corps: { markSent: true } };
}

// ── Refaire, qui coûte un crédit ────────────────────────────────────────────

/* « Refaire » et « Réessayer » sont le même geste : une NOUVELLE demande.
 *
 * Elle vise l'OCCASION, jamais le proche — `startGenerationSchema` refuse
 * `personId` pour tout ce qui n'est pas un portrait, et refuse
 * `studioSelection`, qui n'a de sens que pour une image. Le corps se forme donc
 * de deux champs, et le test le repasse dans le schéma réel.
 *
 * Sans occasion connue, on ne peut rien relancer : l'écran retire alors le
 * bouton plutôt que d'en offrir un qui échouerait — « aucun geste muet », et
 * pas de bouton grisé.
 */
export function relanceDuMessage(occurrenceId: string | undefined): Envoi | null {
  if (!occurrenceId) return null;
  return {
    chemin: "/me/generations",
    corps: { kind: "wish_message", occurrenceId },
  };
}

/* Le drapeau garde la PRODUCTION, pas la relecture. Éteint, « Refaire »
   disparaît ; le texte déjà payé se lit, s'ajuste et s'envoie toujours. */
export function offreDeRefaire(actives: readonly string[]): boolean {
  return estActive(actives, "generation.message");
}

/* LE PIÈGE DU BRIEF : « l'achat éteint ne ferme pas les générations, il les
   rend gratuites ». Un coût annoncé ou un solde rappelé mentirait à quelqu'un
   qui vient de recevoir quelque chose sans payer — les deux sortent de
   l'écran. */
export function montreLeCout(actives: readonly string[]): boolean {
  return estActive(actives, "credits");
}
