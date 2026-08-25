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
