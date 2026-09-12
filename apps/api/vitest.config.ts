import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 30_000,
    /* LE CONTENEUR SE LÈVE UNE FOIS, ICI, et non dans chaque `beforeAll`.
       Voir `test/socle.ts` : 105 fichiers × 66 migrations faisaient 6 930
       exécutions de migration par course. */
    globalSetup: ["./test/socle.ts"],
    // Le montage d'un fichier n'est plus qu'un `CREATE DATABASE … TEMPLATE`.
    // Le délai reste large : c'est une garde, pas un budget.
    hookTimeout: 120_000,
    pool: "forks",
    poolOptions: { forks: { singleFork: true } }, // une seule base partagée
  },
});
