// Injecté en ligne dans <head>, il s'exécute avant la première peinture.
// Un navigateur en navigation privée peut refuser localStorage : d'où le try.
export const themeScript = `
try {
  var choix = localStorage.getItem("lehno.theme");
  var sombre = choix === "dark" ||
    ((!choix || choix === "system") && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = sombre ? "dark" : "light";
} catch (e) {
  document.documentElement.dataset.theme = "light";
}
`.trim();
