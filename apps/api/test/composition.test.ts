import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { composerLePortrait, type Cadre } from "../src/me/composition.js";

/**
 * La composition du portrait, au serveur.
 *
 * CE QU'ON ÉPROUVE ICI n'est pas l'esthétique — elle se juge à l'œil — mais ce
 * qui casserait sans qu'on le voie : une apostrophe qui fend le SVG, un texte
 * qui déborde du cadre, une image qui sort aux mauvaises dimensions.
 */
describe("la composition du portrait", () => {
  const CADRE: Cadre = {
    fond: "#FFFFFF", bande: "#EDEAF7", texte: "#221F2B", mention: "#5A4B93",
  };

  const illustration = (): Promise<Buffer> =>
    sharp({ create: { width: 1024, height: 1024, channels: 3, background: "#7B6BB7" } })
      .png().toBuffer();

  it("rend un carré de 1080, le côté qu'exporte le système de design", async () => {
    const png = await composerLePortrait(await illustration(), CADRE, {
      phrase: "Celle qui plante avant que le jour se lève.", nom: "Célarine",
    });
    const m = await sharp(png).metadata();
    expect(m.width).toBe(1080);
    expect(m.height).toBe(1080);
    expect(m.format).toBe("png");
  });

  /* LE TEXTE VIENT D'UN MODÈLE, donc d'un tiers. Une apostrophe ou une
     esperluette collée telle quelle dans un SVG fend le document — et l'image
     avec, sans qu'aucune erreur ne dise pourquoi. C'est le genre de panne qui
     n'arrive que sur les phrases les plus naturelles en français. */
  it("survit à une apostrophe, une esperluette et un chevron", async () => {
    const png = await composerLePortrait(await illustration(), CADRE, {
      phrase: `L'amie d'enfance & celle qui <ose> toujours.`,
      nom: `L'Aînée & Cie`,
    });
    expect((await sharp(png).metadata()).width).toBe(1080);
  });

  /* Le gabarit borne déjà la phrase à vingt-quatre mots. Ce plafond est la
     SECONDE garde : celle qui tient si le modèle déborde, et qui empêche la
     bande de manger l'illustration. */
  it("ne laisse pas une phrase trop longue envahir l'image", async () => {
    const interminable = Array.from({ length: 80 }, () => "un mot").join(" ");
    const png = await composerLePortrait(await illustration(), CADRE, {
      phrase: interminable, nom: "Célarine",
    });
    expect((await sharp(png).metadata()).height).toBe(1080);
  });

  // Une phrase vide ne doit pas produire d'image cassée : le portrait existe,
  // son auteur l'a payé.
  it("compose encore sans phrase", async () => {
    const png = await composerLePortrait(await illustration(), CADRE, { phrase: "", nom: "Awa" });
    expect((await sharp(png).metadata()).width).toBe(1080);
  });

  /* LA MENTION EST DANS L'IMAGE, pas dans l'invite. C'est la seule façon
     qu'elle soit exacte à chaque fois — un modèle d'image rendrait « lehno.io »
     approximatif, et une adresse fausse sur un cadeau ne se rattrape pas.
     On ne peut pas lire le texte d'un PNG ; ce qu'on vérifie est que la bande
     existe et porte la couleur du cadre, là où la mention s'écrit. */
  it("pose la bande dans la couleur du cadre, où la mention s'inscrit", async () => {
    const png = await composerLePortrait(await illustration(), CADRE, {
      phrase: "Une phrase courte.", nom: "Awa",
    });
    // Un point dans la bande basse, loin du texte : c'est le fond de bande.
    const { data } = await sharp(png)
      .extract({ left: 540, top: 1060, width: 1, height: 1 })
      .raw().toBuffer({ resolveWithObject: true });
    const [r, v, b] = [data[0]!, data[1]!, data[2]!];
    const attendu = [0xED, 0xEA, 0xF7];
    for (const [i, c] of attendu.entries()) {
      expect(Math.abs([r, v, b][i]! - c)).toBeLessThan(8);
    }
  });
});
