/* Les langues, isolées de `index.ts`.
 *
 * Extraites ici parce que `notifications.ts` en a besoin et que `index.ts`
 * l'exporte : les laisser dans `index.ts` ferait un cycle d'imports. Il se
 * résoudrait sans doute au chargement, mais l'ordre d'évaluation d'un cycle
 * dépend de qui importe qui en premier — et ça se découvre en production, sur
 * une valeur qui vaut `undefined` alors qu'elle est déclarée juste au-dessus.
 */
export const LOCALES = ["fr", "en"] as const;
export type Locale = (typeof LOCALES)[number];
