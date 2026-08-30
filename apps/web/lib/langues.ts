export const LANGUES = ["fr", "en"] as const;
export type Langue = (typeof LANGUES)[number];

export function estLangue(valeur: string): valeur is Langue {
  return (LANGUES as readonly string[]).includes(valeur);
}

// Le français d'abord : c'est la langue par défaut du produit. L'anglais ne
// s'obtient que si le navigateur le demande, et il le demande mieux que par
// simple présence — d'où le tri par facteur de qualité.
export function langueDemandee(acceptLanguage: string | null): Langue {
  if (!acceptLanguage) return "fr";

  const preferees = acceptLanguage
    .split(",")
    .map((morceau) => {
      const [etiquette = "", ...parametres] = morceau.trim().split(";");
      const q = parametres.find((p) => p.trim().startsWith("q="));
      return { base: etiquette.trim().toLowerCase().split("-")[0] ?? "", q: q ? Number(q.split("=")[1]) : 1 };
    })
    .filter((p) => p.base.length > 0 && !Number.isNaN(p.q) && p.q > 0)
    .sort((a, b) => b.q - a.q);

  for (const { base } of preferees) {
    if (estLangue(base)) return base;
  }
  return "fr";
}

/* L'en-tête par lequel le middleware transmet la langue au rendu.
 *
 * Il n'existe que pour `not-found.tsx`, seul rendu du site à ne pas recevoir
 * les paramètres de route. Partout ailleurs, la langue vient de `params` — et
 * doit continuer d'en venir : un en-tête se perd au premier rendu statique. */
export const ENTETE_LANGUE = "x-lehno-langue";
