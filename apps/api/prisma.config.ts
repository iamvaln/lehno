import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { defineConfig } from "prisma/config";

// La base d'exemple vaut pour tout le monorepo : .env vit à la racine,
// deux niveaux au-dessus de ce fichier.
config({ path: fileURLToPath(new URL("../../.env", import.meta.url)), quiet: true });

export default defineConfig({
  schema: "../../prisma/schema.prisma",
});
