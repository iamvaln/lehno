import { defineConfig } from "vitest/config";

export default defineConfig({
  // tsconfig.json laisse le JSX intact pour que Next le compile ; en test, c'est
  // esbuild qui le transforme, et il lui faut le runtime automatique — sinon il
  // émet des appels à React sans que rien ne l'importe.
  esbuild: { jsx: "automatic" },
  test: {
    // Le script de thème se teste en Node — il reçoit ses globales en paramètres.
    // Tout ce qui se rend en composant a besoin d'un DOM : jsdom, par motif de
    // fichier plutôt qu'un par un.
    environment: "node",
    environmentMatchGlobs: [["test/*.test.tsx", "jsdom"]],
    setupFiles: ["test/setup.ts"],
  },
});
