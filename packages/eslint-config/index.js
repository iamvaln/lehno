import js from "@eslint/js";
import tseslint from "typescript-eslint";

export { adherence } from "./adherence.js";

export default tseslint.config(
  // Les motifs sont ancrés sur le dossier de la configuration : sans « **/ », un
  // « .next/** » n'ignore que celui de la racine, et le premier build d'apps/web
  // noie « pnpm lint » sous ses fichiers produits. next-env.d.ts est écrit par Next,
  // qui y met la référence en triple barre que la règle interdit.
  // Ce paquet n'ignore que ce que la compilation produit — il vaut pour tout
  // consommateur, quelle que soit sa disposition. Ce qui tient à la disposition
  // de ce dépôt-ci — specs/, .worktrees/ — est déclaré dans son eslint.config.js
  // racine : deux endroits qui diraient la même chose finiraient par se
  // contredire.
  {
    ignores: [
      "**/dist/**", "**/.next/**", "**/.turbo/**", "**/node_modules/**",
      // Engendrés : `next-env.d.ts` par Next, `.expo/types` par expo-router à
      // chaque démarrage du serveur. Les relire reviendrait à faire relire au
      // linteur ce qu'un outil vient d'écrire, et à porter ses avertissements
      // sans pouvoir les corriger.
      "**/next-env.d.ts", "**/.expo/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Un « _ » en tête marque un paramètre volontairement inutilisé.
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
);
