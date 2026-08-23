import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import "./styles/global.css";

const racine = document.getElementById("racine");
if (!racine) throw new Error("l'élément racine est introuvable");

createRoot(racine).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
