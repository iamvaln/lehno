import type { Adaptateur, DemandeIA, ReponseIA } from "../routeur.service.js";
import { traduire, traduireReseau, EXTRAIT } from "./echecs.js";

const DELAI_MS = 60_000;
const JETONS_MAX = 2_000;

/* Anthropic — l'API Messages.
 *
 * Un appel HTTP direct plutôt que le SDK : la surface employée tient en une
 * requête, et une dépendance de plus serait une dépendance de plus à suivre.
 * Même raisonnement que ResendAdapter.
 *
 * La consigne système voyage dans un champ `system` À PART, jamais dans le
 * fil des messages — c'est la forme qu'attend cette API, et l'y mêler la
 * ferait lire comme une parole de l'utilisateur, donc comme quelque chose
 * qu'une invite peut contredire. */
export class AnthropicAdaptateur implements Adaptateur {
  constructor(private readonly cle: string) {
    if (!cle) throw new Error("ANTHROPIC_API_KEY est requise pour AnthropicAdaptateur");
  }

  async appeler(modele: string, demande: DemandeIA): Promise<ReponseIA> {
    let res: Response;
    try {
      res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": this.cle,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: modele,
          max_tokens: JETONS_MAX,
          ...(demande.systeme === undefined ? {} : { system: demande.systeme }),
          messages: [{ role: "user", content: demande.invite }],
        }),
        signal: AbortSignal.timeout(DELAI_MS),
      });
    } catch (err: unknown) {
      throw traduireReseau(err);
    }

    if (!res.ok) throw traduire(res.status, (await res.text()).slice(0, EXTRAIT));

    const corps = (await res.json()) as {
      content?: { type: string; text?: string }[];
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const texte = (corps.content ?? [])
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("");

    /* Une réponse vide n'est pas une panne : le modèle a répondu, il n'a rien
       dit. Replier redemanderait la même chose à un autre modèle pour le même
       silence — et ferait payer deux fois. */
    if (texte.length === 0) throw traduire(400, "empty completion");

    return {
      contenu: texte,
      ...(corps.usage?.input_tokens === undefined ? {} : { jetonsEntree: corps.usage.input_tokens }),
      ...(corps.usage?.output_tokens === undefined ? {} : { jetonsSortie: corps.usage.output_tokens }),
    };
  }
}
