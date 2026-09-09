/* Amorçage des cartes de composants.
   En production, le compilateur du design system publie un bundle : les
   composants s'y trouvent sous un namespace global. Hors compilation (aperçu
   local, fichier ouvert seul), on retombe sur les sources .jsx, transpilées à
   la volée par Babel. Les deux chemins donnent le même résultat. */
/* Le bundle compilé, s'il existe, est chargé ici plutôt que référencé en dur
   dans chaque page : il n'existe qu'après compilation, et une balise <script>
   statique laisserait un 404 dans toutes les pages hors compilation. */
const lehnoBase = (document.currentScript && document.currentScript.src || "")
  .replace(/components\/_card-boot\.js.*$/, "");

const lehnoBundle = new Promise((resolve) => {
  if (!lehnoBase) return resolve(false);
  const el = document.createElement("script");
  el.src = lehnoBase + "_ds_bundle.js";
  el.onload = () => resolve(true);
  el.onerror = () => resolve(false);
  document.head.appendChild(el);
});

window.lehnoBoot = async function lehnoBoot(sources) {
  await lehnoBundle;
  const wanted = sources.map((s) => s.split("/").pop().replace(/\.jsx?$/, ""));

  // 1. Le bundle est-il là ? (accès protégé : certaines clés de window sont
  //    des frames cross-origin qui lèvent à la lecture)
  for (const key of Object.keys(window)) {
    try {
      const v = window[key];
      if (v && typeof v === "object" && wanted.every((n) => typeof v[n] === "function")) return v;
      // eslint-disable-next-line no-unused-expressions
    } catch (e) { /* frame inaccessible — on passe */ }
  }

  // 2. Sinon, on lit les sources. Les fetch partent tous ensemble ; seule la
  //    transpilation reste séquentielle, chaque module recevant les précédents.
  const textes = await Promise.all(sources.map((path) =>
    fetch(path).then((r) => {
      if (!r.ok) throw new Error(path + " → " + r.status);
      return r.text();
    })
  ));

  const out = {};
  sources.forEach((path, i) => {
    const bare = textes[i]
      .replace(/^\s*import\b[^;\n]*;\s*$/gm, "")
      .replace(/^\s*export\s+/gm, "");
    const name = path.split("/").pop().replace(/\.jsx?$/, "");
    // Tous les exports nommés, pas seulement celui qui porte le nom du fichier :
    // un module peut exposer une donnée à côté de son composant.
    const exportes = [];
    const re = /^\s*export\s+(?:const|function|let|class)\s+([A-Za-z_$][\w$]*)/gm;
    let m;
    while ((m = re.exec(textes[i]))) if (exportes.indexOf(m[1]) < 0) exportes.push(m[1]);
    // On ne force le nom du fichier que si le module n'expose rien d'autre :
    // un module de données (COPY, PROCHES) n'a pas d'export homonyme.
    if (!exportes.length) exportes.push(name);

    const deps = Object.keys(out);
    // Babel refuse un « return » au niveau racine : on enveloppe avant de transpiler.
    const wrapped = "(function(React" + deps.map((d) => ", " + d).join("") + "){\n"
      + bare + "\nreturn {" + exportes.join(", ") + "};\n})";
    const code = Babel.transform(wrapped, {
      // Runtime « classic » : l'automatique émettrait un `import` que l'eval
      // ne sait pas résoudre.
      presets: [["react", { runtime: "classic" }]]
    }).code;
    const rendu = (0, eval)(code)(window.React, ...deps.map((d) => out[d]));
    // Les exports du module rejoignent la table ; celui qui porte le nom du
    // fichier reste la clé principale, et les dépendances s'injectent par nom.
    Object.keys(rendu).forEach((k) => { if (rendu[k] !== undefined) out[k] = rendu[k]; });
  });
  return out;
};

/* Exécution des blocs de démonstration.
   On n'utilise pas type="text/babel" : l'exécution automatique de Babel dépend
   d'un DOMContentLoaded qui peut avoir déjà eu lieu selon l'hôte. Le type
   "text/lehno" est ignoré du navigateur comme de Babel, et c'est nous qui le
   transpilons — une seule fois, à coup sûr. */
function lehnoRunDemos() {
  const blocs = document.querySelectorAll('script[type="text/lehno"]:not([data-lehno-done])');
  blocs.forEach((bloc) => {
    bloc.setAttribute("data-lehno-done", "1");
    let code;
    try {
      code = Babel.transform("(async () => {\n" + bloc.textContent + "\n})()", {
        presets: [["react", { runtime: "classic" }]]
      }).code;
    } catch (err) {
      return lehnoFail(err);
    }
    try {
      const p = (0, eval)(code);
      if (p && p.catch) p.catch(lehnoFail);
    } catch (err) {
      lehnoFail(err);
    }
  });
}

function lehnoFail(err) {
  const root = document.getElementById("root");
  if (root) {
    root.style.cssText = "font-family:var(--font-body);font-size:13px;color:var(--feedback-error);padding:16px";
    root.textContent = "Erreur d'amorçage : " + (err && err.message ? err.message : err);
  }
  console.error(err);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", lehnoRunDemos);
} else {
  lehnoRunDemos();
}
