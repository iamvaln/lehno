import {
  createCollectionLinkSchema,
  type CollectionLink, type CreateCollectionLinkInput,
} from "@lehno/contracts";

/* Le lien de collecte — §3.20.
 *
 * « Envoyez ce lien : ce qui en revient passe par votre validation avant
 * d'entrer dans la fiche. » Deux natures, et elles ne se ressemblent pas — un
 * lien NOMINATIF complète une fiche précise, un lien PUBLIC ne vise personne et
 * peut créer la fiche à la validation.
 */

/* LE LIEN EST DURABLE : « pas d'expiration, seulement une révocation ». Un lien
   révoqué « ne mène plus à rien » et ne se rallume pas — le contrat n'offre que
   la création et la suppression. La copie propose « Réactiver un lien » ; elle
   se contredit elle-même deux lignes plus bas, en disant « vous pouvez en créer
   un autre ». C'est la seconde qui dit vrai. */
export function estVivant(lien: CollectionLink): boolean {
  return lien.isActive;
}

/* CELUI QU'ON MONTRE POUR UNE FICHE : le lien vivant, s'il y en a un.
 *
 * Plusieurs liens révoqués peuvent traîner derrière un proche — on en a créé,
 * révoqué, recréé. Ils n'ont rien à dire : c'est le vivant qu'on partage, et
 * lui seul. En montrer plusieurs ferait choisir entre des adresses dont une
 * seule répond.
 */
export function lienVivantPour(
  liens: readonly CollectionLink[],
  personId: string,
): CollectionLink | null {
  return liens.find((l) => l.personId === personId && estVivant(l)) ?? null;
}

/* Le lien PUBLIC du compte, s'il existe. Il ne vise personne, donc il ne s'en
   trouve qu'un à la fois qui vaille. */
export function lienPublicVivant(liens: readonly CollectionLink[]): CollectionLink | null {
  return liens.find((l) => l.type === "public" && estVivant(l)) ?? null;
}

/* CE QU'ON DEMANDE POUR EN CRÉER UN.
 *
 * `personId` n'accompagne QUE le nominatif : le contrat refuse les deux autres
 * combinaisons, et il a raison — « un lien nominatif désigne une fiche », « un
 * lien public ne vise aucune fiche ». Le poser sur un public laisserait croire
 * qu'on sait déjà où ranger ce qui reviendra, alors que c'est précisément la
 * question que la validation posera.
 */
export function corpsDeCreation(
  type: CollectionLink["type"],
  personId: string | null,
): CreateCollectionLinkInput {
  return createCollectionLinkSchema.parse({
    type,
    ...(type === "nominatif" && personId ? { personId } : {}),
  });
}
