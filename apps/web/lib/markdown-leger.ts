// Un analyseur Markdown volontairement étroit : les documents légaux
// (apps/api/src/public/legal/*.md) n'emploient qu'un sous-ensemble fixe de la
// syntaxe — un h1, une ligne de version en italique juste après, des h2 (les
// sections du sommaire), parfois des h3 imbriqués, des paragraphes enroulés
// sur plusieurs lignes physiques, des listes à puce dont les items s'enroulent
// aussi, du gras et des liens. Rien d'autre n'apparaît dans les six fichiers
// à ce jour (tableaux, citations, listes numérotées, imbrication de listes).
// Un analyseur générique aurait traîné du code mort pour de la syntaxe que le
// contenu réel n'utilise jamais.

export type Inline =
  | { type: "texte"; valeur: string }
  | { type: "gras"; valeur: string }
  | { type: "lien"; texte: string; href: string };

export type Bloc =
  | { type: "paragraphe"; contenu: Inline[] }
  | { type: "liste"; items: Inline[][] }
  | { type: "sous-titre"; texte: string };

export type Section = { id: string; titre: string; blocs: Bloc[] };

export type DocumentLegal = { titre: string; maj: string; chapeau: Inline[]; sections: Section[] };

// Un identifiant d'ancre stable : sans accent, sans ponctuation, en
// minuscules. « 1. Première section » devient « 1-premiere-section ».
function identifiant(titre: string): string {
  return titre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Gras et liens à l'intérieur d'un texte déjà recollé (une ligne logique, pas
// une ligne physique). Aucune imbrication : un gras ne contient jamais de
// lien, ce que le contenu réel ne fait de toute façon jamais.
function analyserInline(texte: string): Inline[] {
  const inlines: Inline[] = [];
  const motif = /\*\*(.+?)\*\*|\[(.+?)\]\((.+?)\)/g;
  let dernierIndex = 0;
  for (const m of texte.matchAll(motif)) {
    const debut = m.index ?? 0;
    if (debut > dernierIndex) inlines.push({ type: "texte", valeur: texte.slice(dernierIndex, debut) });
    if (m[1] !== undefined) inlines.push({ type: "gras", valeur: m[1] });
    else inlines.push({ type: "lien", texte: m[2]!, href: m[3]! });
    dernierIndex = debut + m[0].length;
  }
  if (dernierIndex < texte.length) inlines.push({ type: "texte", valeur: texte.slice(dernierIndex) });
  return inlines;
}

// Rassemble des lignes physiques wrappées en une ligne logique : les espaces
// de fin/début de chaque ligne sont retirés avant la jointure, pour ne pas
// doubler l'espace qui sépare déjà deux mots wrappés.
function recoller(lignes: string[]): string {
  return lignes.map((l) => l.trim()).join(" ");
}

export function analyserMarkdown(source: string): DocumentLegal {
  const lignes = source.replace(/\r\n/g, "\n").split("\n");

  let titre = "";
  let maj = "";
  // Le chapeau n'existe que dans confidentialite.{fr,en}.md : un paragraphe
  // d'introduction entre la ligne de version et le premier h2. cgu.md et
  // mentions.md n'en portent pas — c'est pourquoi il reste un tampon de
  // lignes brutes plutôt qu'un simple booléen « déjà vu », au cas où un futur
  // document en porterait plus d'un paragraphe.
  let chapeauLignes: string[] = [];
  const sections: Section[] = [];

  // Section « hors sommaire » : ce qui précède le premier h2 (le h1 et sa
  // ligne de version). Ses blocs ne sont jamais exposés — titre et maj
  // suffisent à les représenter — mais on la garde comme section courante
  // tant qu'aucun h2 n'est apparu, pour que la boucle ait toujours une cible.
  let courante: Section = { id: "", titre: "", blocs: [] };
  let enTete = true;

  // Un tampon de lignes physiques en cours d'accumulation, et sa nature :
  // un paragraphe ordinaire, ou les items d'une liste à puces.
  let tamponParagraphe: string[] = [];
  let tamponListe: string[][] = [];

  const clorePragraphe = (): void => {
    if (tamponParagraphe.length === 0) return;
    const recollee = recoller(tamponParagraphe);
    if (enTete) {
      if (maj === "") {
        // La ligne de version s'écrit en italique (`_..._`) : ce sont les
        // seuls soulignés du format, on les retire plutôt que de les
        // interpréter. C'est toujours le premier paragraphe du document.
        maj = recollee.replace(/^_(.*)_$/, "$1");
      } else {
        chapeauLignes.push(recollee);
      }
    } else {
      courante.blocs.push({ type: "paragraphe", contenu: analyserInline(recollee) });
    }
    tamponParagraphe = [];
  };

  const cloreListe = (): void => {
    if (tamponListe.length === 0) return;
    courante.blocs.push({
      type: "liste",
      items: tamponListe.map((item) => analyserInline(recoller(item))),
    });
    tamponListe = [];
  };

  const clore = (): void => { clorePragraphe(); cloreListe(); };

  for (const ligneBrute of lignes) {
    const ligne = ligneBrute;

    if (/^\s*$/.test(ligne)) {
      clore();
      continue;
    }

    const h1 = /^#\s+(.+)$/.exec(ligne);
    if (h1) {
      clore();
      titre = h1[1]!.trim();
      continue;
    }

    const h2 = /^##\s+(.+)$/.exec(ligne);
    if (h2) {
      clore();
      enTete = false;
      const texte = h2[1]!.trim();
      courante = { id: identifiant(texte), titre: texte, blocs: [] };
      sections.push(courante);
      continue;
    }

    const h3 = /^###\s+(.+)$/.exec(ligne);
    if (h3) {
      clore();
      courante.blocs.push({ type: "sous-titre", texte: h3[1]!.trim() });
      continue;
    }

    const puce = /^-\s+(.+)$/.exec(ligne);
    if (puce) {
      clorePragraphe();
      tamponListe.push([puce[1]!]);
      continue;
    }

    // Une ligne indentée pendant qu'une liste est en cours en est la suite
    // physique du dernier item ; sinon, c'est la suite d'un paragraphe.
    if (tamponListe.length > 0 && /^\s+\S/.test(ligne)) {
      tamponListe[tamponListe.length - 1]!.push(ligne.trim());
      continue;
    }

    cloreListe();
    tamponParagraphe.push(ligne);
  }
  clore();

  const chapeau = chapeauLignes.length > 0 ? analyserInline(chapeauLignes.join(" ")) : [];
  return { titre, maj, chapeau, sections };
}
