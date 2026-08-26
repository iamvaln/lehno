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
  maintTitre: "Lehno revient",
  maintTexte: "Une mise à jour est en cours.",
  maintHeure: (h: string) => "De retour vers " + h + ".",
  maintReessayer: "Réessayer",
  maintEtat: "Voir l'état du service",
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

  // ── Le carnet ─────────────────────────────────────────────────────────────
  // Transposé de `handoff_people_mobile/ui_kits/app/copy.js`.
  //
  // Le décompte garde SES DEUX NOTATIONS. Le brief d'intégration le dit :
  // « la notation du décompte — J−3 / 3 days — n'est pas tranchée, ne pas la
  // figer dans un composant ». Les deux vivent donc ici, et le choix se fait
  // à un seul endroit, le jour où il se fera.
  ajouterCeProche: "Ajouter ce proche",
  ajouterProche: "Ajouter un proche",
  aujourdhui: "aujourd'hui",
  champAppelle: "Comment vous l'appelez",
  champAppelleAide: "C'est ce nom qui apparaît dans les messages — « Maman », « mon vieux ».",
  champCanal: "Par où vous lui écrivez",
  champCanalAide: "Oriente la longueur du message proposé.",
  champLangueProche: "Langue des messages",
  champNom: "Nom",
  champRegistre: "Registre",
  champRelation: "Le lien",
  champRelationHint: "Où vous vous êtes connus",
  champRelationHintAide: "Une phrase suffit : « on s'est connus à la fac ».",
  champVille: "Ville",
  champVilleAide: "Pour suggérer des adresses et des sorties.",
  chargement: "Chargement",
  completer: "Compléter",
  decompteBarre: (n: number) => "J−" + n,
  decomptePhrase: (n: number) => n === 1 ? "dans 1 jour" : "dans " + n + " jours",
  effacer: "Effacer",
  enregistrer: "Enregistrer",
  ficheAjouterDate: "Ajouter une date",
  ficheAjouterNote: "Ajouter une note",
  ficheCollecteCourt: "Faire compléter",
  ficheGoutsReste: (n: number) => "+" + n + " autres",
  ficheIdentiteCourt: "Identité",
  ficheInterets: "Intérêts et goûts",
  ficheNotes: "Ce que vous avez noté",
  fichePortraitsCourt: "Portraits",
  fichePreparer: (date: string) => "Préparer le " + date,
  identiteIntro: "Ces quelques éléments orientent ce que Lehno écrit.",
  identiteRegistreAide: "Le ton des messages proposés.",
  identiteSupprimer: "Supprimer cette fiche",
  identiteSupprimerAide: "Les notes et les dates partent avec.",
  identiteTitre: "Ce que Lehno doit savoir",
  noteEviter: "À éviter",
  noteIdee: "Idée",
  procheAucuneNote: "Rien de noté encore",
  procheNotes: (n: number) => n === 1 ? "1 note" : n + " notes",
  prochesCompte: (n: number) => n + " proches",
  prochesReste: (n: number) => "Voir plus · " + n + " restants",
  prochesTitre: "Vos proches",
  rechercher: "Rechercher un proche",
  triAlphaAZ: "A–Z",
  triAlphaZA: "Z–A",
  triDate: "Par date",
  triDateLoin: "au plus loin",
  triDateProche: "au plus proche",
  videAnnuaireTexte: "Ajoutez un proche et une date. Le reste se remplit au fil de l'année.",
  videAnnuaireTitre: "Personne dans le carnet",
  videRechercheTexte: "Essayez un prénom, ou ajoutez cette personne.",
  videRechercheTitre: "Rien sous ce nom",

  // Les libellés des énumérations du contrat. `lib/libelles.ts` les relie aux
  // valeurs ; le type y impose l'exhaustivité, donc une valeur ajoutée au
  // contrat ne compile pas tant que sa traduction manque.
  typeAnniversaire: "Anniversaire",
  typeAutre: "Autre",
  relFamilleProche: "Famille proche",
  relFamilleEtendue: "Famille étendue",
  relAmi: "Ami",
  relPartenaire: "Partenaire",
  relCollegue: "Collègue",
  relPro: "Relation pro",
  relConnaissance: "Connaissance",
  registreFamilier: "Familier",
  registreAmical: "Amical",
  registreFormel: "Formel",
  canalWhatsapp: "WhatsApp",
  canalSms: "SMS",
  canalEmail: "E-mail",
  canalAutre: "Autre",
};
