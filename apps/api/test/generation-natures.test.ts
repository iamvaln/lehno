import { describe, expect, it } from "vitest";
import { startGenerationSchema, type CleDrapeau } from "@lehno/contracts";
import { GenerationController } from "../src/me/generation.controller.js";
import type { GenerationService } from "../src/me/generation.service.js";
import type { FlagsService } from "../src/flags/flags.service.js";

/* Le lancement décide de TROIS choses avant de toucher au crédit : la nature
   est-elle allumée, sait-on la produire, et la demande est-elle formée. Ces
   épreuves ne parlent que des deux premières — elles n'ont donc besoin ni de
   base ni de modèle, et le service double REFUSE d'être appelé : c'est ainsi
   qu'on prouve que rien n'a été débité, plutôt qu'en relisant un solde. */

const OCCURRENCE = "11111111-1111-4111-8111-111111111111";
const PROCHE = "22222222-2222-4222-8222-222222222222";

const jamais = (): never => {
  throw new Error("le service ne devait pas être appelé : un crédit aurait pu être débité");
};

const controleur = (allumes: CleDrapeau[]): GenerationController =>
  new GenerationController(
    { lancerMessage: jamais, lancerIdees: jamais, lire: jamais } as unknown as GenerationService,
    { estActif: async (cle: CleDrapeau) => allumes.includes(cle) } as unknown as FlagsService,
  );

const TOUS: CleDrapeau[] = ["generation.message", "generation.ideas", "generation.portrait"];

const demande = (corps: Record<string, unknown>) => startGenerationSchema.parse(corps);

describe("le drapeau qui garde un lancement est celui de la nature demandée", () => {
  /* LE défaut que ce fichier existe pour retenir. La route portait
     `@Feature("generation.message")` : demander des idées exigeait donc que le
     MESSAGE soit allumé, et `generation.ideas` s'allumait au back-office sans
     rien changer. */
  it("ne demande pas le drapeau du message pour des idées", async () => {
    const sansLeMessage: CleDrapeau[] = ["generation.ideas", "generation.portrait"];
    /* Le service double lève : atteindre son cri prouve que les deux refus —
       drapeau éteint, nature non produite — ont été franchis. Si le drapeau du
       message était encore exigé, on tomberait sur un `not_found` avant.
       Ce cas attendait `resource_inactive` tant que les idées n'étaient pas
       produites ; elles le sont, et il vérifie maintenant la même chose par le
       seul chemin qui reste. */
    await expect(
      controleur(sansLeMessage).lancer(
        { userId: "u" },
        demande({ kind: "gift_ideas", occurrenceId: OCCURRENCE }),
      ),
    ).rejects.toThrow("le service ne devait pas être appelé");
  });

  /* `not_found`, comme FeatureGuard : une nature éteinte n'a pas à révéler
     qu'elle existe. Le client traite déjà ce statut comme un écran fermé. */
  it("répond comme à une ressource absente quand la nature est éteinte", async () => {
    const cas = [
      { nature: "wish_message", drapeau: "generation.message", cible: { occurrenceId: OCCURRENCE } },
      { nature: "gift_ideas", drapeau: "generation.ideas", cible: { occurrenceId: OCCURRENCE } },
      { nature: "portrait", drapeau: "generation.portrait", cible: { personId: PROCHE } },
    ] as const;

    for (const { nature, drapeau, cible } of cas) {
      // TOUT allumé SAUF le sien : si un autre drapeau suffisait, la demande
      // passerait et le service double le crierait.
      const sansLeSien = TOUS.filter((c) => c !== drapeau);
      await expect(
        controleur(sansLeSien).lancer({ userId: "u" }, demande({ kind: nature, ...cible })),
        nature,
      ).rejects.toMatchObject({ code: "not_found" });
    }
  });

  /* ALLUMÉE N'EST PAS CONSTRUITE, et les deux ne se disent pas pareil : une
     nature éteinte se rallume au back-office, une nature sans chaîne de
     production ne s'allume nulle part. Confondre les deux ferait chercher un
     interrupteur qui n'existe pas. */
  it("distingue l'extinction de l'absence de production", async () => {
    /* Le portrait reste la nature SANS chaîne de production : allumé partout,
       il refuse quand même, et par un code différent de l'extinction.
       Les idées ont quitté cette liste — elles se produisent depuis. Le jour où
       le portrait la quittera aussi, ce cas n'aura plus de sujet et devra
       disparaître plutôt que d'être rafistolé sur une nature inventée. */
    await expect(
      controleur(TOUS).lancer({ userId: "u" }, demande({ kind: "portrait", personId: PROCHE })),
    ).rejects.toMatchObject({ code: "resource_inactive" });

    // Et la comparaison qui donne son sens au cas : éteint, le même portrait
    // répond `not_found`. Deux refus, deux causes, deux codes.
    const sansLePortrait = TOUS.filter((c) => c !== "generation.portrait");
    await expect(
      controleur(sansLePortrait).lancer({ userId: "u" }, demande({ kind: "portrait", personId: PROCHE })),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("laisse passer le message quand son drapeau est allumé", async () => {
    // Le service double lève : atteindre cette exception prouve qu'aucune des
    // deux gardes n'a arrêté la demande.
    await expect(
      controleur(TOUS).lancer({ userId: "u" }, demande({ kind: "wish_message", occurrenceId: OCCURRENCE })),
    ).rejects.toThrow("le service ne devait pas être appelé");
  });
});
