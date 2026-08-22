import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Le script de thème se teste en Node — il reçoit ses globales en paramètres.
    // La landing se rend dans un DOM : jsdom, choisi par fichier.
    environment: "node",
    environmentMatchGlobs: [["test/landing.test.tsx", "jsdom"]],
    setupFiles: ["test/setup.ts"],
  },
});
