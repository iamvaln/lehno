import { Logger } from "@nestjs/common";
import type { Mail, MailPort } from "./mail.port.js";

// Adaptateur de production : un appel HTTP à l'API Resend, authentifié par
// jeton porteur. `fetch` est global depuis Node 18, et l'appel tient en une
// requête — le SDK n'apporterait ici qu'une dépendance de plus à suivre, pour
// une surface qu'on maîtrise entièrement.
//
// L'adresse d'expédition vient de la configuration : Resend exige un domaine
// vérifié chez lui, et ce domaine n'est pas déductible de la clé.
export class ResendAdapter implements MailPort {
  private readonly logger = new Logger(ResendAdapter.name);

  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {
    if (!apiKey || !from) {
      throw new Error("RESEND_API_KEY et RESEND_FROM sont requis pour ResendAdapter");
    }
  }

  async send(mail: Mail): Promise<void> {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: this.from,
        to: [mail.to],
        subject: mail.subject,
        text: mail.text,
      }),
    });

    if (!res.ok) {
      // Jamais le destinataire ni aucun contenu du courrier dans le journal —
      // masqué à l'écriture, pas retiré après coup. Seuls la nature de l'échec
      // et le statut rendu par le prestataire comptent pour diagnostiquer.
      this.logger.error(`resend send failed: status=${res.status}`);
      throw new Error(`resend send failed with status ${res.status}`);
    }
  }
}
