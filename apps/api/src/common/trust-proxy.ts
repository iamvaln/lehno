// Combien de relais inverses se tiennent devant l'API, et qu'on exploite
// soi-même.
//
// `req.ip` sert à composer les clés de limitation de débit (voir
// AuthService et WaitlistService). En direct, c'est l'adresse de la connexion
// TCP : rien à régler. Derrière un relais, cette adresse devient celle du
// relais — la même pour tout le monde —, et le plafond « par origine » se
// transforme en compteur unique partagé : le onzième visiteur de l'heure se
// fait refuser à cause des dix précédents.
//
// Express sait retrouver le visiteur dans l'en-tête X-Forwarded-For, à
// condition qu'on lui dise combien d'adresses écarter par la droite. Ce nombre
// vaut exactement le nombre de relais qu'on exploite. Le régler trop haut — ou
// le mettre à `true`, ce que proposent la plupart des exemples en ligne — fait
// remonter jusqu'au premier maillon de la chaîne, celui que le client écrit
// lui-même : n'importe qui s'accorde alors autant d'origines qu'il veut, et le
// plafond ne borne plus rien.
//
// D'où le refus de `true` ci-dessous, et le zéro par défaut : en l'absence de
// configuration, on préfère un plafond trop strict à un plafond contournable.
const MAXIMUM_VRAISEMBLABLE = 4;

export function nombreDeRelaisDeConfiance(valeur: string | undefined): number {
  if (valeur === undefined || valeur === "") return 0;

  if (!/^\d+$/.test(valeur)) {
    throw new Error(
      `TRUST_PROXY_HOPS doit être un nombre de relais (reçu : « ${valeur} »). ` +
      "« true » ferait confiance à la chaîne entière, y compris au maillon que le client écrit lui-même.",
    );
  }

  const nombre = Number(valeur);
  if (nombre > MAXIMUM_VRAISEMBLABLE) {
    throw new Error(
      `TRUST_PROXY_HOPS vaut ${nombre}, ce qui dépasse le nombre de relais vraisemblable ` +
      `(${MAXIMUM_VRAISEMBLABLE}) : plus le compte est haut, plus on remonte vers une adresse que le client contrôle.`,
    );
  }

  return nombre;
}
