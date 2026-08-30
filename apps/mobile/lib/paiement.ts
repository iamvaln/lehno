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

/* LES OPÉRATEURS SE CHOISISSENT, ils ne se tapent pas.
 *
 * `brand` est du texte libre au contrat, et rien côté serveur ne le normalise.
 * Laissé à la saisie, « MTN MoMo », « MTN Momo » et « mtn momo » deviennent
 * trois marques qui ne se regroupent nulle part — ni dans la liste de
 * quelqu'un, ni dans un rapprochement d'administration.
 *
 * La liste vient des CANAUX servis, pas d'une constante : ce sont les
 * opérateurs que la plateforme sait débiter. En écrire une ici la ferait
 * vieillir en silence — un opérateur ajouté en back-office n'apparaîtrait
 * jamais, et un opérateur retiré resterait proposé.
 *
 * On ne garde que les canaux de la sorte qu'on sait ajouter : proposer
 * l'opérateur d'une carte ferait enregistrer un compte mobile money chez un
 * réseau qui n'en a pas.
 */
export function operateursProposables(canaux: readonly PaymentChannel[]): string[] {
  const vus = new Set<string>();
  const noms: string[] = [];
  for (const c of canaux) {
    if (c.kind !== SORTE_AJOUTABLE) continue;
    const nom = c.operator.trim();
    const clef = nom.toLowerCase();
    if (nom === "" || vus.has(clef)) continue;
    vus.add(clef);
    noms.push(nom);
  }
  return noms;
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
 * `brand` ne part que s'il est choisi : le contrat le donne facultatif, et une
 * chaîne vide en ferait une marque nommée « rien » plutôt qu'une marque
 * absente. `providerRef` n'est jamais joint — le schéma le refuse nommément sur
 * un mobile money, « un compte mobile money n'a pas de référence prestataire ».
 */
export function corpsDEnregistrement(
  numero: string,
  operateur: string | null,
): RegisterPaymentMethodInput {
  const marque = operateur?.trim() ?? "";
  return registerPaymentMethodSchema.parse({
    kind: SORTE_AJOUTABLE,
    msisdn: numero.trim(),
    ...(marque === "" ? {} : { brand: marque }),
  });
}

/* CE QUI AUTORISE L'ENREGISTREMENT.
 *
 * La borne vient du CONTRAT — six caractères — et non d'une idée de ce à quoi
 * ressemble un numéro. Plus strict que le serveur refuserait un numéro qu'il
 * aurait accepté, et personne n'aurait moyen de le savoir. Même raison qu'au
 * versement manuel : « les opérateurs ne s'accordent sur rien ».
 *
 * L'opérateur est EXIGÉ ici alors que le contrat l'accepte absent : sans lui,
 * la liste montre quatre chiffres sans dire de qui, et c'est précisément ce
 * qu'on relit pour reconnaître son propre numéro.
 */
export function enregistrementComplet(numero: string, operateur: string | null): boolean {
  return numero.trim().length >= 6 && operateur !== null && operateur.trim() !== "";
}
