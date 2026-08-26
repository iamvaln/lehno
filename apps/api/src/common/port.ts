// Sur quel port l'API écoute.
//
// `Number(process.env.PORT ?? 3000)` semble juste et ne l'est pas : `PORT`
// déclaré vide dans un fichier d'environnement n'est pas `undefined`, c'est la
// chaîne vide. Le `??` ne se déclenche donc pas, et `Number("")` vaut `0` —
// qui, pour Node, veut dire « choisis un port libre au hasard ».
//
// L'application démarre, annonce « started », et écoute là où personne ne la
// cherche. En développement on perd une demi-heure ; en production le
// conteneur passe ses contrôles de santé sur un port qui n'écoute pas, et le
// relais rend 502 sur une application parfaitement vivante.
//
// Une valeur qui n'est pas un port refuse le démarrage plutôt que d'en
// inventer un : mieux vaut un échec lisible qu'une écoute fantôme.
const DEFAUT = 3000;
const MAXIMUM = 65_535;

export function portDecoute(valeur: string | undefined): number {
  if (valeur === undefined || valeur === "") return DEFAUT;

  if (!/^\d+$/.test(valeur)) {
    throw new Error(
      `PORT doit être un nombre (reçu : « ${valeur} »). ` +
      "Une valeur illisible ferait écouter l'application sur un port tiré au hasard.",
    );
  }

  const nombre = Number(valeur);
  // Zéro est un port valide pour Node — « au hasard » — mais jamais une
  // intention : personne ne configure une API pour qu'on ne puisse pas
  // l'atteindre. On le refuse comme le reste.
  if (nombre === 0 || nombre > MAXIMUM) {
    throw new Error(
      `PORT vaut ${nombre}, qui n'est pas un port d'écoute (1 à ${MAXIMUM}). ` +
      "Zéro ferait écouter l'application sur un port tiré au hasard.",
    );
  }

  return nombre;
}
