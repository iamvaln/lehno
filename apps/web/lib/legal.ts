import { analyserMarkdown, type DocumentLegal } from "./markdown-leger.js";
import type { Langue } from "./langues.js";

// Les trois documents légaux que le pied de page relie (voir SiteFooter.tsx) :
// conditions, confidentialité, mentions légales.
export type Document = "cgu" | "confidentialite" | "mentions";

// Même raisonnement que CONFIG_REPLI (lib/config-publique.ts) : une page
// légale doit s'afficher même API éteinte. Un document vide serait un 404
// silencieux ; celui-ci porte un titre et le dit sans détour, dans la langue
// de la page — d'où une fonction plutôt qu'une constante unique.
const REPLI_PAR_LANGUE: Record<Langue, DocumentLegal> = {
  fr: {
    titre: "Contenu indisponible",
    maj: "",
    chapeau: [
      { type: "texte", valeur: "Ce texte n'a pas pu être chargé pour le moment. Réessayez dans un instant, ou écrivez à " },
      { type: "lien", texte: "hello@lehno.io", href: "mailto:hello@lehno.io" },
      { type: "texte", valeur: "." },
    ],
    sections: [],
  },
  en: {
    titre: "Content unavailable",
    maj: "",
    chapeau: [
      { type: "texte", valeur: "This text could not be loaded right now. Try again in a moment, or write to " },
      { type: "lien", texte: "hello@lehno.io", href: "mailto:hello@lehno.io" },
      { type: "texte", valeur: "." },
    ],
    sections: [],
  },
};

export function documentRepli(langue: Langue): DocumentLegal {
  return REPLI_PAR_LANGUE[langue];
}

export async function chargerDocumentLegal(
  document: Document,
  langue: Langue,
  revalidate: number,
): Promise<DocumentLegal> {
  const base = process.env["API_URL"];
  if (!base) return documentRepli(langue);
  try {
    const reponse = await fetch(`${base}/v1/public/legal/${document}?lang=${langue}`, { next: { revalidate } });
    if (!reponse.ok) return documentRepli(langue);
    return analyserMarkdown(await reponse.text());
  } catch {
    // Serveur injoignable, DNS muet, délai dépassé : la page paraît quand même.
    return documentRepli(langue);
  }
}
