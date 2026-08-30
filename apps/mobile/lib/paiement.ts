import {
  registerPaymentMethodSchema,
  type PaymentChannel, type PaymentMethod, type RegisterPaymentMethodInput,
} from "@lehno/contracts";

/* Les méthodes de paiement enregistrées — §3.25.
 *
 * L'écran suit `topup.provider` : sans paiement automatique, il n'y a rien à
 * enregistrer, on verse à la main et on déclare. Mais la ROUTE, elle, n'est
 * sous aucun drapeau, et le contrôleur explique pourquoi — « ces méthodes
 * servent aussi le REMBOURSEMENT promis à la suppression de compte, qui doit
 * fonctionner même quand le paiement automatique est éteint ». C'est §3.24 qui
 * les lit alors, par `eligibleMethods`, et non cet écran-ci.
 */

/* CE QU'ON PEUT AJOUTER DEPUIS L'APPLICATION, et c'est UNE seule chose.
 *
 * La maquette dessine les deux : « Le numéro mobile money » et « Le numéro de
 * carte » avec sa date d'expiration. La seconde ne peut pas exister ici.
 *
 * Une carte s'enregistre par `providerRef` — « la référence opaque que le
 * prestataire rend ». Le contrat ne prend NI le numéro de carte NI l'échéance :
 * `registerPaymentMethodSchema` est `strict`, il les refuserait. Et c'est la
 * bonne réponse, pas une lacune : un champ « numéro de carte » ferait transiter
 * un PAN par notre application et notre serveur, ce que personne ici n'est
 * outillé pour porter. La référence naît chez le prestataire, dans SA page ;
 * tant que cette page n'est pas intégrée, la carte ne s'ajoute pas.
 *
 * Les cartes déjà enregistrées se LISENT quand même dans la liste : elles
 * existent, elles servent, et une carte absente de l'écran ne se retirerait
 * plus. On sait donc en montrer une sans savoir en créer une.
 */
export const SORTE_AJOUTABLE = "mobile_money" as const;

/* ON CHOISIT UN CANAL, PAS UN OPÉRATEUR ÉCRIT.
 *
 * Le contrat est catégorique — « l'opérateur vient du canal, il ne se saisit
 * pas » —, et `brand` est refusé sur un mobile money. C'est mieux que ce que
 * j'avais fait d'abord, qui prenait le NOM de l'opérateur du canal pour le
 * renvoyer en texte : le nom se serait mis à diverger du canal à la première
 * retouche de back-office, et personne n'aurait su lequel des deux disait vrai.
 *
 * La liste vient donc des canaux servis, et ce sont eux qu'on montre : ce que
 * la plateforme sait débiter, à l'instant où on le demande. Une constante
 * écrite ici vieillirait en silence — un opérateur ajouté n'apparaîtrait
 * jamais, un opérateur retiré resterait proposé et l'enregistrement échouerait
 * sur un canal inactif.
 *
 * On garde les DEUX canaux d'un même opérateur quand il y en a deux : ils ne
 * portent pas le même barème, `label` les distingue, et en fondre un dans
 * l'autre ferait choisir à la place de quelqu'un ce qu'il paiera en plus.
 */
export function canauxProposables(canaux: readonly PaymentChannel[]): PaymentChannel[] {
  return canaux.filter((c) => c.kind === SORTE_AJOUTABLE);
}

/* CE QUE L'ENREGISTREMENT VA FAIRE, dit avant le geste.
 *
 * « Un seul numéro par opérateur, et changer de numéro est le geste ordinaire —
 * pas ajouter. » Le serveur SUPPRIME donc la ligne existante chez cet opérateur
 * et en crée une neuve : le délai avant qu'elle puisse recevoir un
 * remboursement repart de zéro, « et c'est voulu — hériter de l'ancienneté d'un
 * numéro qu'on vient de changer viderait la garde anti-fraude de son sens ».
 *
 * Le bouton ne peut donc pas dire « Ajouter » dans les deux cas : il effacerait
 * un numéro sans le dire, et la perte ne se découvrirait que sur la liste.
 *
 * L'opérateur se lit sur `operator`, servi exprès. `brand` ne convient PAS —
 * il est nul sur un mobile money depuis que le canal porte l'opérateur, et
 * s'en servir ferait annoncer « rien à remplacer » à chaque fois.
 */
export function methodeRemplacee(
  methodes: readonly PaymentMethod[],
  canal: PaymentChannel,
): PaymentMethod | null {
  const vise = canal.operator.trim().toLowerCase();
  return methodes.find(
    (m) => m.operator !== null && m.operator.trim().toLowerCase() === vise,
  ) ?? null;
}

/* CE QUI EST « PAR DÉFAUT » NE SE DÉCIDE PAS ICI.
 *
 * La maquette pose un interrupteur « En faire ma méthode par défaut ». Il n'a
 * rien à régler : le contrat n'a pas de champ pour ça, et
 * `registerPaymentMethodSchema` étant `strict`, l'envoyer ferait échouer
 * l'enregistrement au lieu de l'orienter.
 *
 * Le défaut est une CONSÉQUENCE — `lastUsedAt` porte la règle, « la méthode
 * proposée par défaut à l'achat : la plus récente ». On la calcule donc pour
 * poser le repère, et on ne la choisit pas.
 *
 * Aucune méthode n'a servi : AUCUN repère. Le serveur lui-même n'aurait rien à
 * proposer — `startPaymentSchema` ne retient « la plus récemment utilisée »
 * que s'il y en a une. Coiffer la première de la liste inventerait un défaut
 * que l'achat ne suivrait pas.
 */
export function methodeParDefaut(methodes: readonly PaymentMethod[]): string | null {
  let tenante: PaymentMethod | null = null;
  for (const m of methodes) {
    if (m.lastUsedAt === null) continue;
    if (tenante === null || m.lastUsedAt.localeCompare(tenante.lastUsedAt!) > 0) tenante = m;
  }
  return tenante?.id ?? null;
}

/* EXPIRÉE se lit sur le mois, jamais sur le jour.
 *
 * Une carte vaut jusqu'à la FIN de son mois d'échéance : la comparer au jour
 * près la barrerait pendant les quelques semaines où elle fonctionne encore,
 * et quelqu'un la retirerait pour rien.
 *
 * `expiresAt` est nul sur un compte mobile money — il n'expire pas. Nul ne veut
 * donc pas dire « inconnu », il veut dire « sans objet ».
 */
export function estExpiree(methode: PaymentMethod, aujourdhui: string): boolean {
  if (methode.expiresAt === null) return false;
  return methode.expiresAt.slice(0, 7) < aujourdhui.slice(0, 7);
}

/* CE QUE LE RETRAIT COÛTE, dit AVANT le geste.
 *
 * Le remboursement promis aux CGU §6 exige une méthode « enregistrée depuis
 * plus de deux semaines et ayant déjà servi à un paiement ». Un retrait ne se
 * rattrape donc pas en réenregistrant le même numéro : la ligne est SUPPRIMÉE,
 * pas désactivée, et la suivante repart d'une ancienneté nulle. Le délai
 * recommence, et il faut en plus qu'un paiement passe.
 *
 * Trois situations, et elles n'appellent pas la même phrase :
 *
 * - `rien` — la méthode n'était pas remboursable ; on ne perd rien qu'on avait ;
 * - `il-en-reste` — d'autres tiennent encore la promesse ;
 * - `la-derniere` — après ce retrait, PLUS AUCUNE. C'est le seul cas où
 *   quelqu'un peut se retrouver avec un solde remboursable et nulle part où le
 *   rendre : §3.24 le décrit, « l'écran l'explique et oriente vers
 *   l'assistance ».
 *
 * On lit `refundEligible`, jamais l'ancienneté : le verdict est au serveur
 * « parce que le délai est réglable en back-office, et deux versions du parc
 * appliqueraient deux règles ». C'est aussi pourquoi la copie ne chiffre pas
 * l'attente — aucune route ne sert ce délai, et l'écrire en dur le figerait
 * dans une version livrée.
 */
export type Consequence = "rien" | "il-en-reste" | "la-derniere";

export function consequenceDuRetrait(
  methodes: readonly PaymentMethod[],
  id: string,
): Consequence {
  const partante = methodes.find((m) => m.id === id);
  if (partante === undefined || !partante.refundEligible) return "rien";
  const restantes = methodes.some((m) => m.id !== id && m.refundEligible);
  return restantes ? "il-en-reste" : "la-derniere";
}

/* Ce qu'on envoie pour enregistrer un compte mobile money.
 *
 * NI `brand` NI `providerRef` : le schéma les refuse tous les deux nommément
 * sur un mobile money — « l'opérateur vient du canal, il ne se saisit pas » et
 * « un compte mobile money n'a pas de référence prestataire ». Les joindre
 * ferait échouer l'enregistrement, pas dériver l'affichage.
 */
export function corpsDEnregistrement(
  numero: string,
  canalId: string,
): RegisterPaymentMethodInput {
  return registerPaymentMethodSchema.parse({
    kind: SORTE_AJOUTABLE,
    msisdn: numero.trim(),
    channelId: canalId,
  });
}

/* CE QUI AUTORISE L'ENREGISTREMENT.
 *
 * La borne vient du CONTRAT — six caractères — et non d'une idée de ce à quoi
 * ressemble un numéro. Plus strict que le serveur refuserait un numéro qu'il
 * aurait accepté, et personne n'aurait moyen de le savoir. Même raison qu'au
 * versement manuel : « les opérateurs ne s'accordent sur rien ».
 */
export function enregistrementComplet(numero: string, canalId: string | null): boolean {
  return numero.trim().length >= 6 && canalId !== null;
}
