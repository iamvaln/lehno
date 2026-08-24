import js from "@eslint/js";
import tseslint from "typescript-eslint";

export { adherence } from "./adherence.js";

export default tseslint.config(
  // Les motifs sont ancrés sur le dossier de la configuration : sans « **/ », un
  // « .next/** » n'ignore que celui de la racine, et le premier build d'apps/web
  // noie « pnpm lint » sous ses fichiers produits. next-env.d.ts est écrit par Next,
  // qui y met la référence en triple barre que la règle interdit.
  {
    ignores: [
      "**/dist/**", "**/.next/**", "**/.turbo/**", "**/node_modules/**",
      "**/next-env.d.ts",
      // specs/ porte les planches de conception et les paquets de passation :
      // des prototypes écrits pour être lus et transposés, pas pour être
      // compilés. Les linter revient à corriger le brouillon d'un designer —
      // et un doublon de clé y est parfois voulu, l'un écrasant l'autre pour
      // montrer une variante.
      "**/specs/**",
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
