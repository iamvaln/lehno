// Injecté en ligne dans <head>, il s'exécute avant la première peinture.
// <body> n'existe pas encore à ce moment : la classe se pose sur la racine,
// et la feuille fait porter le thème par les deux.
export const themeScript = `
try {
  var choix = localStorage.getItem("lehno.theme");
  var sombre = choix === "dark" ||
    ((!choix || choix === "system") && matchMedia("(prefers-color-scheme: dark)").matches);
  if (sombre) document.documentElement.classList.add("lehno-nuit");
} catch (e) {}
`.trim();
