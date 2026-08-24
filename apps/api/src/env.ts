import { config } from "dotenv";
import { fileURLToPath } from "node:url";

// Chargé pour son effet, avant toute autre chose : les modules qui lisent
// process.env le font à la construction de l'application, et un import est
// évalué avant le corps du fichier qui l'importe. Ce module doit donc être le
// PREMIER import de main.ts — placé après, il arriverait trop tard.
//
// Deux fichiers, dans cet ordre : `.env.local` d'abord, `.env` ensuite.
// dotenv n'écrase jamais une variable déjà posée, donc le premier lu gagne —
// c'est ce qui donne la précédence au fichier local, celui qui porte les vrais
// secrets et que git ignore. `.env` reste la base partagée.
//
// Une variable venue de l'environnement réel l'emporte sur les deux : en
// conteneur, c'est l'orchestrateur qui fournit la configuration, et un fichier
// oublié dans une image ne doit pas pouvoir la contredire.
//
// Un fichier absent n'est pas une erreur : dotenv passe son chemin.
const racine = (nom: string): string => fileURLToPath(new URL(`../../../${nom}`, import.meta.url));

for (const nom of [".env.local", ".env"]) {
  config({ path: racine(nom), quiet: true });
}
