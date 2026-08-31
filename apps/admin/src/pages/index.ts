// Les cinq écrans de l'outil. Les quatre gabarits couvrent les quinze sections :
// la spec impose le même modèle partout, et c'est ce qui rend l'outil prévisible.
export { TableauDeBord } from "./TableauDeBord.js";
export { Liste } from "./Liste.js";
export { Detail } from "./Detail.js";
export { Edition } from "./Edition.js";
export { Suppressions } from "./Suppressions.js";

// La connexion vit hors de la coquille : ni barre latérale, ni barre haute.
export { Connexion } from "./Connexion.js";
export { Profil } from "./Profil.js";
export { Lecture, type LectureProps } from "./Lecture.js";
export { Modeles, type ModelesProps } from "./Modeles.js";
export { Drapeaux, type DrapeauxProps } from "./Drapeaux.js";
export { Credits, type CreditsProps } from "./Credits.js";
export { SaisiePaiement, type SaisiePaiementProps } from "./SaisiePaiement.js";
export { Acces, type AccesProps } from "./Acces.js";
export { Assistance, type AssistanceProps } from "./Assistance.js";

// La seule page qui n'appelle personne : un registre tenu dans le code.
export { Liens, type LiensProps } from "./Liens.js";
export { Studio, type StudioProps } from "./Studio.js";
export { TransactionManuelle, type TransactionManuelleProps, type MouvementManuel } from "./TransactionManuelle.js";
export { StatsTransactions, type StatsTransactionsProps } from "./StatsTransactions.js";
export { Metriques, type MetriquesProps } from "./Metriques.js";
