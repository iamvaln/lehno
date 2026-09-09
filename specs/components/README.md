# Composants

Primitives réutilisables. Chaque dossier porte ses `.jsx`, leur `.d.ts` (contrat de
props et règles d'usage), un `.prompt.md` (quoi et quand), et une carte HTML de
démonstration.

| Groupe | Composants |
|---|---|
| `core/` | `Icon` `Button` `Tag` `Card` `SectionLabel` `Avatar` |
| `feedback/` | `Banner` |
| `content/` | `Countdown` `Provenance` `Quote` |
| `forms/` | `TextField` |
| `navigation/` | `TabBar` |
| `brand/` | `Wordmark` `BrandMark` |

Les composants ne dépendent que de React et des variables CSS de `styles.css` :
aucune bibliothèque, aucun CSS-in-JS, aucune feuille de style propre.

## `_card-boot.js`

Utilitaire d'aperçu, pas un composant. Les cartes et les UI kits l'appellent pour
retrouver les composants : d'abord dans le bundle publié par le compilateur, sinon
en transpilant les sources `.jsx` à la volée. Les blocs de démonstration portent
`type="text/lehno"` — un type que le navigateur ignore et que ce fichier exécute
lui-même, l'exécution automatique de Babel dépendant d'un `DOMContentLoaded` qui
peut avoir déjà eu lieu selon l'hôte.
