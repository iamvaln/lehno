import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["test/setup.ts"],
    // Les tests d'écran montent l'application entière et attendent des appels
    // réseau simulés. Cinq secondes suffisent à vide ; sous `pnpm test`, qui
    // lance neuf paquets en parallèle, la contention les fait expirer sans que
    // rien ne soit cassé. Le plafond monte plutôt que de rendre les tests
    // dépendants de la machine qui les exécute.
    testTimeout: 20_000,
  },
});
