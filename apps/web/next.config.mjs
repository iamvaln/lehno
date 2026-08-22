import path from "node:path";

/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // @lehno/tokens expose ses sources TypeScript (main: ./src/index.ts) plutôt qu'un
  // paquet compilé : sans transpilation explicite, la compilation ne sait pas les lire.
  transpilePackages: ["@lehno/tokens", "@lehno/i18n"],

  // La racine du suivi de fichiers est celle de l'espace de travail — sans quoi Next
  // hésite entre deux verrous quand on travaille dans un worktree.
  outputFileTracingRoot: path.join(import.meta.dirname, "..", ".."),

  webpack: (config) => {
    // Les paquets internes importent en « ./x.js » ce qui est écrit en « ./x.ts »,
    // comme l'exige la résolution NodeNext. Vitest le fait nativement, webpack non.
    config.resolve.extensionAlias = { ".js": [".ts", ".tsx", ".js"] };
    return config;
  },
};

export default nextConfig;
