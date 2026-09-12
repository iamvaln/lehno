import { AppError } from "../common/errors.js";
import { tracer, largeur, FRAUNCES_MIN } from "./polices.js";

/* `sharp` se charge À LA DEMANDE — même raison que dans `AvatarService` : c'est
 * une bibliothèque native, et une importation en tête de fichier lierait le
 * DÉMARRAGE de l'API à sa présence. */
type Sharp = (typeof import("sharp"))["default"];
let outil: Sharp | null = null;

async function image(): Promise<Sharp> {
  if (outil !== null) return outil;
  try {
    outil = (await import("sharp")).default;
    return outil;
  } catch {
    throw new AppError("internal_error", "image processing unavailable");
  }
}

/**
 * LA COMPOSITION DU PORTRAIT, au serveur.
 *
 * POURQUOI ICI ET PAS SEULEMENT AU CLIENT. `PortraitComposition` compose déjà à
 * l'écran, et c'est bien : on veut pouvoir changer la mise en page sans
 * refabriquer les images. Mais **le fichier rangé dans le stockage est celui
 * qu'on partage** — par message, par courriel, hors de l'application. S'il
 * sortait nu, il ne porterait rien de Lehno : ni la gamme dans son cadre, ni la
 * mention. Le client peut recomposer à l'écran ; le fichier, lui, doit déjà
 * être fini.
 *
 * ET LE MODÈLE N'ÉCRIT RIEN. C'est la raison d'être de cette étape : un modèle
 * d'image écrit mal — une dédicace mal orthographiée sur un cadeau qu'on offre
 * est pire que pas de dédicace, et un logotype approximatif est pire que pas de
 * logotype. Ici, le texte est posé au pixel près, à chaque fois pareil.
 */
export type Cadre = {
  readonly fond: string;
  readonly bande: string;
  readonly texte: string;
  readonly mention: string;
};

/* Le côté de l'image finie. Le système de design exporte à 1080 : on garde la
   même valeur, sans quoi une composition faite ici et une faite à l'écran ne
   se superposeraient pas. */
const COTE = 1080;

/* Les parts, en centièmes du côté — comme `PortraitComposition`, qui « ne pose
   rien à la main, tout se déduit de la largeur ». L'échelle d'espacement du
   système ne vaut pas ici : ce n'est pas une interface, c'est une image. */
const PART = {
  marge: 5,
  /* LA BANDE SE DÉDUIT DU TEXTE, et elle est MINCE.
   *
   * Deux raisons, et la seconde décide. Une bande épaisse écrase l'image, qui
   * est le sujet : le mot accompagne le portrait, il ne le commente pas.
   *
   * Et elle décide du RECADRAGE. Le modèle rend un carré ; plus la bande est
   * haute, plus la place qui reste est large et basse, et plus il faut couper
   * dans le dessin — c'est ainsi qu'une tête de héron s'est retrouvée hors
   * cadre. Une bande mince laisse une zone presque carrée, où le carré du
   * modèle entre presque tel quel. */
  bandeMin: 9,
  /* Le plafond n'est PAS un couperet sur la phrase — voir plus bas. Il borne ce
     que la bande peut prendre à l'image quand le texte est court ; une phrase
     de trois lignes le dépasse, et c'est la bande qui cède. */
  bandeMax: 15,
  /* LA PHRASE EST EN FRAUNCES, la display de la marque — c'est le mot qu'on
     offre, pas une légende. 2,6 % de 1080 font 28 points, au-dessus des 22 que
     la charte pose comme plancher : en dessous, Fraunces perd ce qui la
     distingue. Une garde le vérifie plutôt que de le supposer.
     Les mentions sont en Karla, à 16 points — dans la plage 10,5-18 de la
     charte. */
  texte: 2.6,
  mention: 1.5,
  filet: 0.1,
} as const;

/* L'adresse, écrite une fois. Elle est posée ICI et jamais dans l'invite : un
   modèle d'image la rendrait approximative, et une adresse fausse sur un cadeau
   ne se rattrape pas. */
const MENTION = "lehno.io";

const pt = (part: number): number => Math.round((part * COTE) / 100);

/* AUCUN ÉCHAPPEMENT ICI, et ce n'est plus un oubli.
 *
 * Il en fallait un tant que la phrase était posée dans un `<text>` : une
 * apostrophe ou une esperluette venue d'un modèle cassait le document, et
 * l'image avec. Depuis que le texte est VECTORISÉ — `tracer()` rend un chemin,
 * et la phrase finit dans l'attribut `d` sous forme de coordonnées — plus aucun
 * caractère du tiers n'atteint le balisage.
 *
 * L'échappement est donc mort avec le `<text>`, et le lint le disait. On le
 * retire plutôt que de le taire : une fonction de sécurité qu'on garde sans
 * l'appeler finit par rassurer quelqu'un qui croit qu'elle protège encore.
 *
 * Si un jour un `<text>` revient dans ce SVG, il faudra le rétablir. */

/* La phrase se coupe à la largeur disponible, en mots — et la largeur se MESURE
   sur la police réelle. Compter les caractères, comme le faisait la première
   version, donne un résultat faux dès qu'un mot porte des « i » ou des « m » :
   une ligne de quarante « i » et une de quarante « m » n'occupent pas la même
   place, et l'une des deux déborde du cadre sans que rien ne le signale. */
function lignes(phrase: string, largeurMax: number, taille: number): string[] {
  const mots = phrase.split(/\s+/).filter(Boolean);
  const sorties: string[] = [];
  let courante = "";
  for (const mot of mots) {
    const essai = courante ? `${courante} ${mot}` : mot;
    if (largeur(essai, "titre", taille) > largeurMax && courante) {
      sorties.push(courante); courante = mot;
    } else courante = essai;
  }
  if (courante) sorties.push(courante);
  /* Trois lignes au plus : au-delà, la bande mangerait l'illustration. Le
     gabarit borne déjà la phrase à vingt-quatre mots, et ce plafond est la
     seconde garde — celle qui tient si le modèle déborde. */
  return sorties.slice(0, 3);
}

/* UNE SEULE LIGNE, coupée à la mesure. Rendre `null` quand il n'y a rien à
   poser plutôt qu'une chaîne vide : le gabarit teste alors une absence, pas un
   contenu vide, et la bande sait se resserrer. */
function laNote(note: string | null, largeurMax: number, taille: number): string | null {
  const propre = note?.trim() ?? "";
  if (propre === "") return null;
  if (largeur(propre, "texte", taille) <= largeurMax) return propre;

  const ELLIPSE = "…";
  const place = largeurMax - largeur(ELLIPSE, "texte", taille);
  let coupe = "";
  for (const c of propre) {
    if (largeur(coupe + c, "texte", taille) > place) break;
    coupe += c;
  }
  return `${coupe.trimEnd()}${ELLIPSE}`;
}

/**
 * Poser l'illustration dans son cadre, avec la phrase et la mention.
 *
 * @param illustration ce que le modèle a rendu — une illustration seule, sans
 *   texte ni cadre : c'est ce que l'invite lui impose.
 */
export async function composerLePortrait(
  illustration: Buffer,
  cadre: Cadre,
  /* `note` — LA NOTE DE L'EXPÉDITEUR, « Fait avec soin par Valentine ».
   *
   * Elle manquait, et le fichier partait sans elle : la spécification la range
   * pourtant dans la bande (« le nom du proche · le message · la note de
   * l'expéditeur · le pied de marque »), et l'écran la montrait dans son aperçu.
   * On voyait donc une chose avant de composer et une autre après — le portrait
   * partagé, le seul qui compte, n'en portait aucune trace.
   *
   * Nulle quand l'expéditeur l'a retirée : c'est un état légitime, pas un
   * oubli. La bande se resserre alors d'autant. */
  textes: { readonly phrase: string; readonly nom: string; readonly note?: string | null },
): Promise<Buffer> {
  const s = await image();

  const marge = pt(PART.marge);
  const tailleTexte = pt(PART.texte);
  /* LA CHARTE POSE UN PLANCHER À FRAUNCES : jamais sous 22 points. On le
     vérifie plutôt que de s'y fier — le jour où quelqu'un rétrécit la bande, la
     display descendrait sous sa limite sans que rien ne le dise, et elle perd
     là ce qui la distingue d'une serif quelconque. */
  if (tailleTexte < FRAUNCES_MIN)
    throw new AppError("internal_error", `la phrase du portrait descend sous ${FRAUNCES_MIN} points`);

  const lignesDeLaPhrase = lignes(textes.phrase, COTE - marge * 2, tailleTexte);

  /* LA HAUTEUR SE CALCULE AVANT DE COUPER L'ILLUSTRATION : le texte, ses
     marges, et la ligne des mentions. Bornée des deux côtés — un plancher pour
     que la bande reste une bande même sans phrase, un plafond pour qu'une
     phrase longue ne mange pas le dessin. */
  /* LA BANDE S'ADAPTE À LA PHRASE, JAMAIS L'INVERSE.
   *
   * Elle a d'abord été calculée sur une hauteur plafonnée : la seconde ligne
   * débordait alors et se superposait au prénom. J'ai corrigé en supprimant la
   * ligne qui dépassait — et « Celle qui plante avant que le jour se » est
   * sorti sans son « lève ».
   *
   * COUPER UNE DÉDICACE AU MILIEU est pire que tout ce qu'on évitait : c'est le
   * mot qu'on offre à quelqu'un. Le plafond borne donc ce que la bande PREND À
   * L'IMAGE quand le texte est court ; dès que la phrase demande davantage,
   * c'est la bande qui cède. Le nombre de lignes est déjà borné à trois en
   * amont, et le gabarit borne la phrase à vingt-quatre mots — deux gardes en
   * amont valent mieux qu'un couperet à l'arrivée. */
  const tailleMention = pt(PART.mention);

  /* LA NOTE TIENT SUR UNE LIGNE, et on la coupe en MESURANT plutôt qu'en
     comptant les caractères — même raison que la phrase : quarante « i » et
     quarante « m » n'occupent pas la même place. Le contrat la borne déjà à
     cent vingt caractères ; ceci est la seconde garde, celle qui tient si
     quelqu'un desserre la première. L'ellipse dit que c'est coupé, au lieu de
     laisser croire que la note s'arrêtait là. */
  const note = laNote(textes.note ?? null, COTE - marge * 2, tailleMention);

  /* La bande grandit d'une ligne quand la note est là, et ne bouge pas quand
     elle a été retirée : une hauteur fixe laisserait un blanc qu'on lirait
     comme un défaut de composition. */
  const hautBande = Math.max(
    pt(PART.bandeMin),
    Math.round(
      lignesDeLaPhrase.length * tailleTexte * 1.4
      + (note === null ? 0 : tailleMention * 1.7)
      + tailleMention * 2.2 + marge * 1.6,
    ),
  );
  const hautIllustration = COTE - hautBande;

  /* LE RECADRAGE PART DU HAUT, jamais du centre ni de « la zone chargée ».
   *
   * `attention` vise le plus contrasté — sur un héron, c'est le corps, et la
   * tête sort du cadre. `top` garde ce qui est en haut, et ce qui se perd est
   * le bas de l'image : un reflet, une ombre, du sol. Un sujet se cadre par la
   * tête, et un modèle place presque toujours son sujet en haut du carré. */
  const posee = await s(illustration)
    .resize(COTE, hautIllustration, { fit: "cover", position: "top" })
    .toBuffer();

  const departTexte = hautIllustration + marge * 0.8 + tailleTexte;

  /* LA MENTION EN BAS À DROITE, POSÉE PAR SA LARGEUR MESURÉE — `text-anchor`
   * n'existe pas pour un tracé : un chemin n'a pas d'ancre, il a des
   * coordonnées. On mesure donc et on soustrait.
   *
   * LA MENTION EN BAS À DROITE, et le filet au-dessus de la bande.
   *
   * `lehno.io` s'écrit ICI et jamais dans l'invite : c'est la seule façon
   * qu'elle soit exacte à chaque fois. Un modèle d'image la rendrait
   * approximative — et une adresse fausse sur un cadeau ne se rattrape pas.
   *
   * La police reste générique. Celle de la charte demanderait de l'embarquer et
   * de configurer fontconfig dans l'image Alpine ; c'est un lot à part, et une
   * police manquante ferait tomber la composition entière sur une machine où
   * elle n'est pas installée. */
  const svg = `<svg width="${COTE}" height="${COTE}" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="${hautIllustration}" width="${COTE}" height="${hautBande}" fill="${cadre.bande}"/>
  <rect x="0" y="${hautIllustration}" width="${COTE}" height="${Math.max(1, pt(PART.filet))}" fill="${cadre.mention}" opacity="0.35"/>
  ${lignesDeLaPhrase.map((l, i) => `<path d="${tracer(l, "titre", tailleTexte, marge, departTexte + i * tailleTexte * 1.4)}" fill="${cadre.texte}"/>`).join("\n  ")}
  ${note === null ? "" : `<path d="${tracer(note, "texte", tailleMention, marge, departTexte + lignesDeLaPhrase.length * tailleTexte * 1.4 + tailleMention * 0.4)}" fill="${cadre.mention}" opacity="0.6"/>`}
  <path d="${tracer(textes.nom, "texte", tailleMention, marge, COTE - marge * 0.9)}" fill="${cadre.mention}" opacity="0.7"/>
  <path d="${tracer(MENTION, "texteMoyen", tailleMention, COTE - marge - largeur(MENTION, "texteMoyen", tailleMention), COTE - marge * 0.9)}" fill="${cadre.mention}" opacity="0.7"/>
</svg>`;

  return s({
    create: { width: COTE, height: COTE, channels: 3, background: cadre.fond },
  })
    .composite([
      { input: posee, top: 0, left: 0 },
      { input: Buffer.from(svg), top: 0, left: 0 },
    ])
    .png()
    .toBuffer();
}
