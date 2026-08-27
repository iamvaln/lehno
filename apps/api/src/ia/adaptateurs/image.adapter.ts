import type { Adaptateur, DemandeIA, ReponseIA } from "../routeur.service.js";
import { traduire, traduireReseau, EXTRAIT } from "./echecs.js";

// Une image prend bien plus longtemps qu'un texte. Garder le délai du texte
// ferait tomber en « timeout » des générations qui allaient aboutir, et le
// disjoncteur écarterait un fournisseur qui va très bien.
const DELAI_MS = 180_000;

/* xAI et OpenAI exposent tous deux `images/generations`, au même dialecte.
 *
 * Ce que rend `contenu` : une donnée en base64, pas une adresse. Les adresses
 * que rendent ces API EXPIRENT — souvent en une heure. Un portrait dont on
 * garderait le lien s'afficherait le jour même et montrerait un trou la semaine
 * suivante, sans que rien n'ait changé de notre côté.
 *
 * ET LES DEUX FOURNISSEURS SE CONTREDISENT SUR LA FAÇON DE LE DEMANDER —
 * vérifié en appelant les deux :
 *
 * - **xAI EXIGE `response_format: "b64_json"`.** Sans ce champ, il rend une
 *   adresse. C'est le cas qui expire.
 * - **OpenAI REFUSE ce champ** (400, « Unknown parameter »). `gpt-image-1` rend
 *   toujours du base64, et lui passer le champ fait échouer l'appel entier.
 *
 * D'où `demandeLeFormat`. Un adaptateur unique sans ce drapeau contentait l'un
 * en cassant l'autre, et aucun test à double factice ne l'aurait montré : les
 * deux API ont la même forme, ce sont leurs exigences qui divergent.
 *
 * Aucun compte de jetons : ces API facturent à l'image. Les jetons restent nuls
 * — « on ne sait pas », qui est la vérité, plutôt que zéro.
 *
 * ATTENTION À LA TAILLE. Mesuré sur une même invite : xAI rend ~130 Ko de
 * base64, OpenAI ~1,8 Mo — treize fois plus. Le base64 pèse déjà un tiers de
 * plus que l'octet brut, et cette chaîne traverse la mémoire du serveur en
 * entier. L'appelant décode et range AVANT de rendre quoi que ce soit : faire
 * transiter ça par une réponse JSON ferait un corps de plusieurs mégaoctets sur
 * un téléphone en 3G, pour une image qu'on aurait de toute façon à stocker. */
export class ImageAdaptateur implements Adaptateur {
  constructor(
    private readonly cle: string,
    private readonly base: string,
    private readonly nom: string,
    private readonly demandeLeFormat: boolean,
  ) {
    if (!cle) throw new Error(`une clé d'API est requise pour ${nom}`);
  }

  async appeler(modele: string, demande: DemandeIA): Promise<ReponseIA> {
    let res: Response;
    try {
      res = await fetch(`${this.base}/images/generations`, {
        method: "POST",
        headers: { authorization: `Bearer ${this.cle}`, "content-type": "application/json" },
        body: JSON.stringify({
          model: modele,
          prompt: demande.invite,
          n: 1,
          ...(this.demandeLeFormat ? { response_format: "b64_json" } : {}),
        }),
        signal: AbortSignal.timeout(DELAI_MS),
      });
    } catch (err: unknown) {
      throw traduireReseau(err);
    }

    if (!res.ok) throw traduire(res.status, (await res.text()).slice(0, EXTRAIT));

    const corps = (await res.json()) as { data?: { b64_json?: string; url?: string }[] };
    const image = corps.data?.[0]?.b64_json;

    /* Une adresse au lieu du base64 demandé est un REFUS, pas une panne : le
       fournisseur a produit l'image mais ne nous la donne pas sous la forme
       qui survit. Replier redemanderait la même chose à un autre — et
       repayerait une image qu'on ne pourra pas garder davantage. */
    if (!image) throw traduire(400, "invalid_request");

    return { contenu: image };
  }
}
