import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // Les motifs sont ancrés sur le dossier de la configuration : sans « **/ », un
  // « .next/** » n'ignore que celui de la racine, et le premier build d'apps/web
  // noie « pnpm lint » sous ses fichiers produits. next-env.d.ts est écrit par Next,
  // qui y met la référence en triple barre que la règle interdit.
  {
    ignores: [
      "**/dist/**", "**/.next/**", "**/.turbo/**", "**/node_modules/**",
      "**/next-env.d.ts",
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
