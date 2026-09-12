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
  /* ─── LA NOTE DE L'EXPÉDITEUR ───────────────────────────────────────────────
   *
   * « Fait avec soin par Valentine ». Elle N'ENTRAIT PAS dans le fichier :
   * l'écran la montrait dans son aperçu, la spécification la range dans la bande
   * (« le nom du proche · le message · la note de l'expéditeur · le pied de
   * marque »), et le portrait partagé n'en portait aucune trace. On voyait une
   * chose avant de composer et une autre après.
   *
   * ON NE PEUT PAS LIRE LE TEXTE D'UN PNG. Ce qui s'éprouve est donc la
   * GÉOMÉTRIE : la bande grandit d'une ligne quand la note est là. C'est
   * suffisant — si elle grandit, c'est qu'une ligne a été posée, et rien d'autre
   * dans cette fonction ne la fait grandir. */
  describe("la note de l'expéditeur", () => {
    /* La hauteur de bande se MESURE en remontant depuis le bas sur une colonne
       vide de texte : la première ligne qui n'est plus de la couleur du cadre
       est le haut de la bande. Prendre la valeur au calcul reviendrait à
       comparer le code à lui-même. */
    const hauteurDeBande = async (png: Buffer): Promise<number> => {
      /* LE PAS VIENT DE L'IMAGE, il ne se suppose pas : la composition SVG rend
         quatre canaux là où l'illustration en a trois, et une constante à trois
         lisait un pixel sur quatre en croyant les lire tous. Le cas rendait
         alors zéro partout — vert par accident si la comparaison avait été dans
         l'autre sens. */
      const { data, info } = await sharp(png)
        .extract({ left: 8, top: 0, width: 1, height: 1080 })
        .raw().toBuffer({ resolveWithObject: true });
      const bande = [0xED, 0xEA, 0xF7];
      let haut = 1080;
      for (let y = 1079; y >= 0; y -= 1) {
        const proche = bande.every((c, i) => Math.abs(data[y * info.channels + i]! - c) < 8);
        if (!proche) break;
        haut = y;
      }
      return 1080 - haut;
    };

    it("fait grandir la bande d'une ligne", async () => {
      const sans = await composerLePortrait(await illustration(), CADRE, {
        phrase: "Une phrase courte.", nom: "Awa",
      });
      const avec = await composerLePortrait(await illustration(), CADRE, {
        phrase: "Une phrase courte.", nom: "Awa", note: "Fait avec soin par Valentine",
      });
      expect(await hauteurDeBande(avec)).toBeGreaterThan(await hauteurDeBande(sans));
    });

    /* RETIRÉE, LA BANDE SE RESSERRE. Une hauteur fixe laisserait un blanc qu'on
       lirait comme un défaut de composition — et « retirer la signature » est un
       geste offert à l'écran, pas un cas limite. */
    it("laisse la bande inchangée quand elle est retirée", async () => {
      const sans = await composerLePortrait(await illustration(), CADRE, {
        phrase: "Une phrase courte.", nom: "Awa",
      });
      for (const vide of [null, "", "   "]) {
        const png = await composerLePortrait(await illustration(), CADRE, {
          phrase: "Une phrase courte.", nom: "Awa", note: vide,
        });
        expect(await hauteurDeBande(png)).toBe(await hauteurDeBande(sans));
      }
    });

    /* LE CONTRAT LA BORNE À CENT VINGT CARACTÈRES ; ceci est la seconde garde,
       celle qui tient si quelqu'un desserre la première. Elle se coupe à la
       MESURE — compter les caractères donnerait un résultat faux dès qu'un mot
       porte des « i » ou des « m ». */
    it("coupe une note trop longue au lieu de déborder", async () => {
      const png = await composerLePortrait(await illustration(), CADRE, {
        phrase: "Une phrase courte.",
        nom: "Awa",
        note: Array.from({ length: 60 }, () => "interminable").join(" "),
      });
      expect((await sharp(png).metadata()).width).toBe(1080);
      expect((await sharp(png).metadata()).height).toBe(1080);
      // Une note d'une seule ligne : la bande ne doit pas avoir triplé.
      expect(await hauteurDeBande(png)).toBeLessThan(400);
    });
  });
});
