import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { construireOpenApi } from "../src/openapi.js";

const sortie = join(import.meta.dirname, "..", "..", "..", "docs", "api");
mkdirSync(sortie, { recursive: true });
// Indenté et terminé par un saut de ligne : le fichier se relit dans un diff.
writeFileSync(join(sortie, "openapi.json"), `${JSON.stringify(construireOpenApi(), null, 2)}\n`);
console.log("docs/api/openapi.json engendré");
