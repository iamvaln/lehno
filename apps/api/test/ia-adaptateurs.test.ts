import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PanneFournisseur, RefusModele } from "../src/ia/routeur.service.js";
import { traduire, traduireReseau } from "../src/ia/adaptateurs/echecs.js";
import { AnthropicAdaptateur } from "../src/ia/adaptateurs/anthropic.adapter.js";
import { CompatibleOpenAIAdaptateur } from "../src/ia/adaptateurs/compatible-openai.adapter.js";
import { ImageAdaptateur } from "../src/ia/adaptateurs/image.adapter.js";
import { construireAdaptateurs } from "../src/ia/adaptateurs/index.js";

/* Les adaptateurs, et surtout la traduction des échecs.
 *
 * C'est elle qui décide si on replie. Se tromper coûte cher dans les deux sens :
 * ranger une panne en refus prive du repli alors qu'un autre fournisseur aurait
 * répondu ; ranger un refus en panne fait payer le même non à chaque rang. */
describe("les adaptateurs d'IA", () => {
  const DEMANDE = { invite: "dis quelque chose" };

  const reponse = (statut: number, corps: unknown): Response =>
    new Response(typeof corps === "string" ? corps : JSON.stringify(corps), {
      status: statut,
      headers: { "content-type": "application/json" },
    });

  beforeEach(() => { vi.unstubAllGlobals(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  describe("la traduction d'un échec", () => {
    // 429 : le fournisseur dit « pas maintenant », et un autre dira oui. C'est
    // exactement le cas où le repli sert à quelque chose.
    it("range une limite de débit en panne, pas en refus", () => {
      expect(traduire(429, "")).toBeInstanceOf(PanneFournisseur);
      expect((traduire(429, "") as PanneFournisseur).code).toBe("rate_limited");
    });

    it("range les 5xx en panne", () => {
      for (const s of [500, 502, 503, 529]) expect(traduire(s, "")).toBeInstanceOf(PanneFournisseur);
    });

    /* La clé est mauvaise : ce n'est pas une panne au sens propre, mais le bon
       geste est le même — replier, puis cesser de frapper. Le motif consigné
       dit « auth », donc l'administration lit la vraie cause. */
    it("range une clé refusée en panne, avec un motif qui dit la vraie cause", () => {
      const e = traduire(401, "") as PanneFournisseur;
      expect(e).toBeInstanceOf(PanneFournisseur);
      expect(e.code).toBe("auth");
    });

    it("range un refus de contenu en refus", () => {
      const e = traduire(400, '{"error":{"message":"content_policy violation"}}');
      expect(e).toBeInstanceOf(RefusModele);
      expect((e as RefusModele).code).toBe("content_policy");
    });

    /* Dans le doute sur un 400, on choisit le REFUS — donc on ne replie pas.
       Mieux vaut un non rendu une fois qu'un non payé trois fois, et une
       requête mal formée par nous se répéterait à l'identique au rang suivant. */
    it("choisit le refus quand un 400 ne nomme rien", () => {
      expect(traduire(400, '{"error":"bad thing"}')).toBeInstanceOf(RefusModele);
    });

    /* ÉPROUVÉ EN VRAI, et c'est ce qui a révélé le piège. DeepSeek dit 402,
       OpenAI dit 400 avec « billing hard limit » — et ce 400 serait tombé dans
       le refus, donc SANS repli, alors qu'un compte à sec est exactement le cas
       où un autre fournisseur doit prendre le relais. */
    it("range un manque de solde en panne, quel que soit le statut employé", () => {
      for (const [statut, corps] of [[402, "Insufficient Balance"], [400, "Billing hard limit has been reached."]] as [number, string][]) {
        const e = traduire(statut, corps);
        expect(e, `statut ${statut}`).toBeInstanceOf(PanneFournisseur);
        expect((e as PanneFournisseur).code).toBe("billing");
      }
    });

    it("range un délai dépassé à part d'une panne ordinaire", () => {
      const e = traduireReseau(Object.assign(new Error("x"), { name: "TimeoutError" }));
      expect((e as PanneFournisseur).code).toBe("timeout");
    });

    it("range une coupure réseau en panne", () => {
      expect((traduireReseau(new Error("ECONNREFUSED")) as PanneFournisseur).code).toBe("network");
    });
  });

  describe("Anthropic", () => {
    it("rend le texte et les jetons comptés", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => reponse(200, {
        content: [{ type: "text", text: "bonjour" }],
        usage: { input_tokens: 12, output_tokens: 3 },
      })));
      const r = await new AnthropicAdaptateur("cle").appeler("claude-opus-5", DEMANDE);
      expect(r).toMatchObject({ contenu: "bonjour", jetonsEntree: 12, jetonsSortie: 3 });
    });

    /* La consigne système va dans un champ À PART, jamais dans le fil des
       messages : l'y mêler la ferait lire comme une parole de l'utilisateur,
       donc comme quelque chose qu'une invite peut contredire. */
    it("envoie la consigne système hors du fil des messages", async () => {
      const appels = vi.fn(async (_u: string, _i?: RequestInit) => reponse(200, { content: [{ type: "text", text: "ok" }] }));
      vi.stubGlobal("fetch", appels);
      await new AnthropicAdaptateur("cle").appeler("m", { invite: "salut", systeme: "sois bref" });

      const corps = JSON.parse(appels.mock.calls[0]![1]!.body as string);
      expect(corps.system).toBe("sois bref");
      expect(JSON.stringify(corps.messages)).not.toContain("sois bref");
    });

    /* Une réponse vide n'est pas une panne : le modèle a répondu, il n'a rien
       dit. Replier redemanderait la même chose pour le même silence. */
    it("traite une réponse vide en refus, pas en panne", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => reponse(200, { content: [] })));
      await expect(new AnthropicAdaptateur("cle").appeler("m", DEMANDE))
        .rejects.toBeInstanceOf(RefusModele);
    });

    it("replie sur un 503 du fournisseur", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => reponse(503, "")));
      await expect(new AnthropicAdaptateur("cle").appeler("m", DEMANDE))
        .rejects.toBeInstanceOf(PanneFournisseur);
    });

    it("refuse d'exister sans clé", () => {
      expect(() => new AnthropicAdaptateur("")).toThrow();
    });
  });

  describe("le dialecte compatible OpenAI", () => {
    const fait = () => new CompatibleOpenAIAdaptateur("cle", "https://exemple.test/v1", "essai");

    it("rend le texte et les jetons comptés", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => reponse(200, {
        choices: [{ message: { content: "salut" } }],
        usage: { prompt_tokens: 7, completion_tokens: 2 },
      })));
      expect(await fait().appeler("deepseek-chat", DEMANDE))
        .toMatchObject({ contenu: "salut", jetonsEntree: 7, jetonsSortie: 2 });
    });

    it("met la consigne système en tête du fil", async () => {
      const appels = vi.fn(async (_u: string, _i?: RequestInit) => reponse(200, { choices: [{ message: { content: "ok" } }] }));
      vi.stubGlobal("fetch", appels);
      await fait().appeler("m", { invite: "salut", systeme: "sois bref" });

      const corps = JSON.parse(appels.mock.calls[0]![1]!.body as string);
      expect(corps.messages[0]).toEqual({ role: "system", content: "sois bref" });
    });

    /* Un refus annoncé dans une réponse à 200. Sans cette lecture, il passerait
       pour une réponse vide, donc pour un incident — et on replierait sur un
       modèle qui filtrerait pareil. */
    it("lit un filtrage annoncé dans une réponse à 200", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => reponse(200, {
        choices: [{ message: { content: "" }, finish_reason: "content_filter" }],
      })));
      const e = await fait().appeler("m", DEMANDE).catch((x: unknown) => x);
      expect(e).toBeInstanceOf(RefusModele);
      expect((e as RefusModele).code).toBe("content_policy");
    });
  });

  describe("les images", () => {
    const fait = (demandeLeFormat = true) =>
      new ImageAdaptateur("cle", "https://exemple.test/v1", "essai", demandeLeFormat);

    /* Les deux fournisseurs se CONTREDISENT, vérifié en appelant les deux :
       xAI exige `response_format` pour rendre du base64 — sans lui il rend une
       adresse, qui expire. OpenAI refuse ce champ et échoue en 400 si on
       l'envoie. Aucun test à double factice ne l'aurait montré : les deux API
       ont la même forme, ce sont leurs exigences qui divergent. */
    it("demande le base64 à qui l'exige", async () => {
      const appels = vi.fn(async (_u: string, _i?: RequestInit) => reponse(200, { data: [{ b64_json: "AAAA" }] }));
      vi.stubGlobal("fetch", appels);
      await fait(true).appeler("grok-imagine-image", DEMANDE);

      expect(JSON.parse(appels.mock.calls[0]![1]!.body as string).response_format).toBe("b64_json");
    });

    it("ne l'envoie pas à qui le refuse", async () => {
      const appels = vi.fn(async (_u: string, _i?: RequestInit) => reponse(200, { data: [{ b64_json: "AAAA" }] }));
      vi.stubGlobal("fetch", appels);
      await fait(false).appeler("gpt-image-1", DEMANDE);

      expect(JSON.parse(appels.mock.calls[0]![1]!.body as string)).not.toHaveProperty("response_format");
    });

    it("rend l'image, sans compter de jetons", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => reponse(200, { data: [{ b64_json: "AAAA" }] })));
      const r = await fait().appeler("grok-imagine-image", DEMANDE);
      // Ces API facturent à l'image : les jetons restent nuls, ce qui est la
      // vérité, plutôt que zéro.
      expect(r).toEqual({ contenu: "AAAA" });
    });

    /* Une adresse au lieu du base64 demandé est un refus, pas une panne : le
       fournisseur a produit l'image mais ne nous la donne pas sous la forme qui
       survit. Replier repayerait une image qu'on ne pourra pas garder. */
    it("refuse une adresse rendue à la place de l'image", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => reponse(200, { data: [{ url: "https://x.test/i.png" }] })));
      await expect(fait().appeler("m", DEMANDE)).rejects.toBeInstanceOf(RefusModele);
    });
  });

  describe("la table des fournisseurs", () => {
    /* Un fournisseur sans clé N'EST PAS CONSTRUIT. Le construire quand même le
       ferait échouer à chaque appel, donc ouvrir le disjoncteur, donc afficher
       « momentanément injoignable » sur un modèle jamais joignable — et on
       chercherait l'incident chez le fournisseur au lieu de la configuration. */
    it("n'inscrit que les fournisseurs dont la clé est posée", () => {
      const table = construireAdaptateurs({ ANTHROPIC_API_KEY: "a", OPENAI_API_KEY: "o" } as NodeJS.ProcessEnv);
      expect(Object.keys(table).sort()).toEqual(["anthropic", "openai"]);
    });

    // Aucune clé n'est obligatoire : l'API sert les proches, les dates et les
    // rappels sans aucune IA. Refuser de démarrer priverait le socle pour une
    // fonctionnalité qui a son propre drapeau.
    it("accepte de n'en inscrire aucun", () => {
      expect(construireAdaptateurs({} as NodeJS.ProcessEnv)).toEqual({});
    });

    /* xAI tient les deux bouts. C'est la clé du modèle qui départage, parce
       qu'une table indexée par fournisseur ne peut pas porter deux entrées. */
    it("aiguille xAI vers l'image ou le texte selon le modèle", async () => {
      const appels = vi.fn(async (url: string) => (String(url).includes("images")
        ? reponse(200, { data: [{ b64_json: "AAAA" }] })
        : reponse(200, { choices: [{ message: { content: "texte" } }] })));
      vi.stubGlobal("fetch", appels);

      const xai = construireAdaptateurs({ XAI_API_KEY: "x" } as NodeJS.ProcessEnv)["xai"]!;
      expect((await xai.appeler("grok-imagine-image", DEMANDE)).contenu).toBe("AAAA");
      expect((await xai.appeler("grok-4.6", DEMANDE)).contenu).toBe("texte");
    });
  });
});
