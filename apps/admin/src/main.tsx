import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import { feuilleDesJetons } from "./styles/variables.js";
import "./styles/global.css";

// Les variables sont posées avant le premier rendu, dans <head> : une feuille
// injectée après coup ferait paraître l'outil sans ses couleurs le temps d'une
// image.
const feuille = document.createElement("style");
feuille.textContent = feuilleDesJetons();
document.head.appendChild(feuille);

const racine = document.getElementById("racine");
if (!racine) throw new Error("l'élément racine est introuvable");

createRoot(racine).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
