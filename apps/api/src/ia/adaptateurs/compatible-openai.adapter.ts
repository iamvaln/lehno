import type { Adaptateur, DemandeIA, ReponseIA } from "../routeur.service.js";
import { traduire, traduireReseau, EXTRAIT } from "./echecs.js";

const DELAI_MS = 60_000;
const JETONS_MAX = 2_000;

/* DeepSeek et xAI parlent tous deux le dialecte `chat/completions` d'OpenAI.
 *
 * Un seul adaptateur pour les deux, paramétré par son adresse : les dupliquer
 * ferait diverger la traduction des échecs, qui est la partie délicate — et
 * c'est justement celle qu'on veut éprouver une fois pour toutes.
 *
 * La consigne système passe par un message de rôle `system`, en tête. C'est la
 * forme de ce dialecte ; Anthropic, lui, la veut dans un champ à part. */
export class CompatibleOpenAIAdaptateur implements Adaptateur {
  constructor(
    private readonly cle: string,
    private readonly base: string,
    private readonly nom: string,
  ) {
    if (!cle) throw new Error(`une clé d'API est requise pour ${nom}`);
  }

  async appeler(modele: string, demande: DemandeIA): Promise<ReponseIA> {
    let res: Response;
    try {
      res = await fetch(`${this.base}/chat/completions`, {
        method: "POST",
        headers: { authorization: `Bearer ${this.cle}`, "content-type": "application/json" },
        body: JSON.stringify({
          model: modele,
          max_tokens: JETONS_MAX,
          messages: [
            ...(demande.systeme === undefined ? [] : [{ role: "system", content: demande.systeme }]),
            { role: "user", content: demande.invite },
          ],
        }),
        signal: AbortSignal.timeout(DELAI_MS),
      });
    } catch (err: unknown) {
      throw traduireReseau(err);
    }

    if (!res.ok) throw traduire(res.status, (await res.text()).slice(0, EXTRAIT));

    const corps = (await res.json()) as {
      choices?: { message?: { content?: string }; finish_reason?: string }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const choix = corps.choices?.[0];
    const texte = choix?.message?.content ?? "";

    /* `finish_reason: "content_filter"` est un REFUS annoncé dans une réponse
       à 200. Sans cette lecture, il passerait pour une réponse vide, donc pour
       un incident — et on replierait sur un modèle qui filtrerait pareil. */
    if (choix?.finish_reason === "content_filter") throw traduire(400, "content_policy");
    if (texte.length === 0) throw traduire(400, "empty completion");

    return {
      contenu: texte,
      ...(corps.usage?.prompt_tokens === undefined ? {} : { jetonsEntree: corps.usage.prompt_tokens }),
      ...(corps.usage?.completion_tokens === undefined ? {} : { jetonsSortie: corps.usage.completion_tokens }),
    };
  }
}
