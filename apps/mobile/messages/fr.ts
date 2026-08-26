// Le dictionnaire du parcours d'entrée, en français.
//
// Transposé de `specs/ui_kits/app/copy.js`, le dictionnaire du kit. Chaque
// variante s'écrit EN ENTIER : les règles de pluriel diffèrent d'une langue à
// l'autre — le zéro prend le singulier en français, le pluriel en anglais — et
// une phrase recollée de morceaux ne peut pas suivre.
//
// Aucun repli d'une langue sur l'autre : un appel qui oublie sa clé doit
// échouer, pas s'afficher dans la mauvaise langue.

export const fr = {
  connexionTitre: "Soyez là le jour J",
  connexionTexte: "Les dates de vos proches, et ce que vous savez d'eux. Le moment venu, vous avez déjà tout pour bien faire.",
  champEmail: "Votre adresse e-mail",
  champEmailEx: "vous@exemple.fr",
  recevoirCode: "Recevoir un code",
  ou: "ou",
  avecGoogle: "Continuer avec Google",
  avecApple: "Continuer avec Apple",
  connexionErreur: "On n'a pas pu joindre Google. Les autres voies restent ouvertes.",
  connexionPiedAvant: "En continuant, vous acceptez les ",
  connexionPiedEntre: " et la ",
  connexionPiedCgu: "conditions d'utilisation",
  connexionPiedConf: "politique de confidentialité",
  connexionPiedApres: ".",
  retour: "Retour",
  codeTitre: "Votre code est parti",
  codeTexte: "Regardez votre boîte de réception.",
  codeValidite: (duree: string) => "Encore " + duree + " pour le saisir.",
  valider: "Valider",
  codeErreur: "Ce code ne correspond pas. Il vous reste deux essais.",
  codeExpire: "Ce code a expiré.",
  renvoyerCode: "Renvoyer un code",
  codeRenvoiAttente: (s: number) => "Nouveau code possible dans " + s + " s",
  /* Le plafond de comptes sur cet appareil. Le ton reste factuel : ce n'est pas
     une faute de la personne, et « refusé » sonnerait comme une sanction. La
     spec veut qu'on donne le moyen de joindre l'assistance — il manque encore
     un écran d'aide où renvoyer. */
  plafondAppareil: "Cet appareil a déjà servi à ouvrir le nombre de comptes permis. Écrivez-nous et nous verrons ensemble.",
  parrainFacultatif: "Si vous arrivez par une invitation, le code va ici.",
  pseudoTitre: "Choisissez votre pseudo",
  champPseudo: "Pseudo",
  pseudoAdresse: "lehno.app/valentine",
  pseudoPris: "Ce pseudo est pris. « valentine2 » est libre.",
  champParrain: "Code de parrainage (facultatif)",
  parrainValide: "Code valide",
  parrainInvalide: "Code invalide",
  continuer: "Continuer",
  bienvenueTitre: (prenom: string) => "Bienvenue, " + prenom,
  bienvenueTexte: "Votre carnet est ouvert. De quoi préparer vos premières célébrations : un portrait, des idées de cadeau, un mot juste.",
  bienvenueCredits: (n: number) => n + (n === 1 ? " crédit" : " crédits"),
  bienvenueCadeau: "Cadeau de bienvenue",
  bienvenueParrainage: "Bonus de parrainage",
  inviterAmi: "Inviter un ami",
  commencer: "Commencer",
  langue: "fr",
};
