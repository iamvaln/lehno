// Sert le contrat publié, lisible dans un navigateur.
//
// Un fichier OpenAPI de deux mille lignes ne se lit pas ; il se parcourt. Ce
// petit serveur rend `docs/api/openapi.json` et une page qui l'affiche —
// chemins, formes, et surtout les NOTES d'intégration, celles qu'aucun schéma
// ne peut dire : quel appel précède quel autre, ce que le serveur exige sans
// que la forme l'annonce, les pièges.
//
// Outil de DÉVELOPPEMENT, jamais déployé. Le contrat lui-même est versionné
// dans le dépôt et se lit aussi bien avec n'importe quel autre visualiseur —
// cette page n'est qu'une commodité, pas une dépendance.
//
// Lancer :  pnpm --filter @lehno/contracts serve-contrat
//
// Le script ne s'appelle PAS « docs » : « pnpm docs » est une commande
// intégrée de pnpm, qui ouvre la page npm du paquet dans le navigateur. Elle
// l'emporte sur un script du même nom, et on se retrouve devant npmjs.com
// sans comprendre pourquoi.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const CONTRAT = join(RACINE, "docs", "api", "openapi.json");
const PORT = Number(process.env["PORT"] ?? 4000);

// Redoc plutôt que Swagger UI : il rend les descriptions Markdown en pleine
// largeur, à côté de chaque chemin, au lieu de les replier dans un accordéon.
// Nos notes sont l'essentiel de cette documentation — les cacher derrière un
// clic reviendrait à ne pas les avoir écrites.
const PAGE = `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Lehno — contrat d'API</title>
    <style>body { margin: 0; font-family: system-ui, sans-serif; }</style>
  </head>
  <body>
    <redoc spec-url="/openapi.json" hide-download-button></redoc>
    <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
  </body>
</html>`;

const serveur = createServer(async (req, res) => {
  try {
    if (req.url === "/openapi.json") {
      // Relu à CHAQUE requête, sans cache : on réengendre le contrat pendant
      // qu'on le regarde, et un cache obligerait à redémarrer le serveur pour
      // voir sa propre modification.
      const contrat = await readFile(CONTRAT, "utf-8");
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      res.end(contrat);
      return;
    }
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(PAGE);
  } catch {
    res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    res.end(
      "docs/api/openapi.json est introuvable — lancer d'abord :\n" +
        "  pnpm --filter @lehno/contracts openapi\n",
    );
  }
});

serveur.listen(PORT, () => {
  console.log(`Contrat d'API servi sur http://localhost:${PORT}`);
  console.log(`  page      http://localhost:${PORT}/`);
  console.log(`  contrat   http://localhost:${PORT}/openapi.json`);
});
