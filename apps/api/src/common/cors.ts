import { ENTETE_JETON_RESERVATION } from "@lehno/contracts";

// Les origines autorisées à appeler l'API depuis un navigateur.
//
// Le site public et l'API vivent sur deux domaines — lehno.io et
// api.lehno.io —, donc chaque envoi de formulaire déclenche une requête
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

  // En développement, deux outils appellent l'API depuis un navigateur, et ils
  // ne peuvent pas tenir sur le même port :
  //
  // - la **landing** sur 3000, défaut de Next ;
  // - le **back-office** sur 5173, défaut de Vite.
  //
  // Le second manquait. L'outil se chargeait, mais chaque appel était refusé
  // par le navigateur avant de partir — il n'était pas utilisable en local.
  // Même défaut que celui qui a valu ce fichier, et pour la même raison : les
  // essais se faisaient en curl, qui n'envoie pas de requête préalable.
  //
  // En développement seulement : la garde de production est juste en dessous,
  // et ces origines n'y entrent jamais.
  if (environnement !== "production") {
    origines.push(
      "http://localhost:3000", "http://127.0.0.1:3000",
      "http://localhost:5173", "http://127.0.0.1:5173",
    );
  }

  return origines;
}

/* Les en-têtes qu'un navigateur a le droit d'envoyer.
 *
 * `content-type` et `authorization` ne suffisent pas : la liste partagée
 * reconnaît un visiteur revenu à `x-lehno-reservation`, et un en-tête absent de
 * cette liste est refusé À LA REQUÊTE PRÉALABLE — la requête ne part jamais.
 * « Le visiteur revenu retrouve les siens, signalés à lui seul » était donc
 * impossible depuis un navigateur, et l'échec est silencieux : la page se
 * charge, elle dit seulement « déjà pris » là où elle aurait dit « par vous ».
 *
 * Le nom vient du CONTRAT, jamais recopié : le jour où il change, les deux
 * bouts changent ensemble.
 *
 * C'est la TROISIÈME fois que ce fichier se fait prendre par la requête
 * préalable — la liste d'attente, puis le back-office sur 5173, puis ceci. À
 * chaque fois pour la même raison, écrite en tête : les essais se faisaient en
 * curl, qui n'en envoie pas.
 */
export const ENTETES_AUTORISES = [
  "content-type",
  "authorization",
  ENTETE_JETON_RESERVATION,
] as const;
