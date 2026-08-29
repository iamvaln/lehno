import { en } from "./en.js";
import { fr } from "./fr.js";

export type Langue = "fr" | "en";

/* La forme du dictionnaire se dérive du français. L'anglais doit s'y conformer,
   et c'est `Record<Langue, Messages>` qui l'y oblige : une clé manquante d'un
   côté ne compile pas.

   Le type ne voit pas tout pour autant — une clé présente des deux côtés mais
   fonction ici et chaîne là passerait. C'est ce que le test du dictionnaire
   attrape, avec le contrôle du genre. */
export type Messages = typeof fr;

export const MESSAGES: Record<Langue, Messages> = { fr, en };

export { en, fr };
