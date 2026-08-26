import { z } from "zod";

/* Les fonctionnalités actives — `/me/features` et `/public/features`.
 *
 * Le serveur rend LA LISTE RÉSOLUE pour le demandeur : ce qui est actif, jamais
 * l'état brut des drapeaux. Il tient le registre, résout les dépendances, et
 * refuse un appel visant une fonctionnalité éteinte. Le client masque, et ne
 * décide de rien — le jour où l'activation deviendra sélective, rien ne changera
 * de ce côté.
 */
export const featuresSchema = z.object({
  features: z.array(z.string()),
}).strict();

export type Features = z.infer<typeof featuresSchema>;

/* Le socle n'a pas de drapeau : c'est ce que le produit est quand tout le reste
   est éteint. C'est aussi ce qui reste debout quand l'appel des drapeaux échoue
   au démarrage — une application qui s'ouvre sur ses proches et ses dates vaut
   mieux qu'une application vide. */
export const SOCLE = [
  "persons", "notes", "events", "occurrences", "reminders", "account",
] as const;
export type CapaciteDuSocle = (typeof SOCLE)[number];

/* Un drapeau inconnu vaut éteint : une version installée ignore une clé créée
   après elle, et le parc ne se met pas à jour d'un bloc. Sans cette règle, une
   clé nouvelle ferait ouvrir un écran que la version ne sait pas rendre. */
export function estActive(actives: readonly string[], capacite: string): boolean {
  if ((SOCLE as readonly string[]).includes(capacite)) return true;
  return actives.includes(capacite);
}
