import { Fraunces, Karla } from "next/font/google";

// next/font télécharge et sert les fichiers depuis notre domaine :
// aucun appel au CDN, donc rien à autoriser dans la politique de contenu (tâche 21).
export const fraunces = Fraunces({
  subsets: ["latin"], display: "swap", variable: "--font-titre",
  axes: ["SOFT", "WONK", "opsz"],
});

export const karla = Karla({
  subsets: ["latin"], display: "swap", variable: "--font-texte",
});
