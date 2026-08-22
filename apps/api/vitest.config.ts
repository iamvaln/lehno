import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 30_000,
    hookTimeout: 120_000, // lever un conteneur prend du temps la première fois
    pool: "forks",
    poolOptions: { forks: { singleFork: true } }, // une seule base partagée
  },
});
