// Les origines autorisées à appeler l'API depuis un navigateur.
//
// Le site public et l'API vivent sur deux domaines — lehno.app et
// api.lehno.app —, donc chaque envoi de formulaire déclenche une requête
// préalable. Sans cette liste, elle répond 404 et rien ne part : ni la liste
// d'attente, ni le formulaire de contact.
//
// Le défaut est passé jusqu'en production parce que les essais se faisaient en
// curl, qui n'envoie pas de requête préalable. Un serveur qui répond n'est pas
// un parcours qui marche.
//
// Liste fermée, jamais « * » : un joker accompagné d'identifiants revient à
// n'avoir aucune protection d'origine. Et sans domaine configuré, on n'autorise
// rien — fermé par défaut, comme les autres secrets de ce projet.
export function originsAutorisees(
  domaine: string | undefined,
  environnement: string = process.env["NODE_ENV"] ?? "development",
): string[] {
  const origines: string[] = [];

  if (domaine) {
    origines.push(`https://${domaine}`, `https://www.${domaine}`);
  }

  // En développement, le site tourne sur 3000 et l'API sur 3001 : même
  // franchissement d'origine, mêmes requêtes préalables.
  if (environnement !== "production") {
    origines.push("http://localhost:3000", "http://127.0.0.1:3000");
  }

  return origines;
}
