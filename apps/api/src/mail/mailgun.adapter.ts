import { Logger } from "@nestjs/common";
import type { Mail, MailPort } from "./mail.port.js";

// Adaptateur de production : un appel HTTP à l'API Mailgun, authentifié en
// Basic ("api" + clé). fetch est global depuis Node 18 : aucune dépendance
// supplémentaire n'est nécessaire pour ce seul appel.
export class MailgunAdapter implements MailPort {
  private readonly logger = new Logger(MailgunAdapter.name);

  constructor(
    private readonly apiKey: string,
    private readonly domain: string,
  ) {
    if (!apiKey || !domain) throw new Error("MAILGUN_API_KEY et MAILGUN_DOMAIN sont requis pour MailgunAdapter");
  }

  async send(mail: Mail): Promise<void> {
    const body = new URLSearchParams({
      from: `Lehno <no-reply@${this.domain}>`,
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
    });

    const res = await fetch(`https://api.mailgun.net/v3/${this.domain}/messages`, {
      method: "POST",
      headers: {
        authorization: `Basic ${Buffer.from(`api:${this.apiKey}`).toString("base64")}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body,
    });

    if (!res.ok) {
      // Jamais le contenu du courrier dans le journal (code à usage unique
      // compris) : seuls le statut et le destinataire sortent d'ici, jamais
      // le sujet ni le texte.
      this.logger.error(`mailgun send failed: status=${res.status} to=${mail.to}`);
      throw new Error(`mailgun send failed with status ${res.status}`);
    }
  }
}

// Adaptateur de développement : affiche le message sur la console. Personne
// n'a besoin d'un compte Mailgun pour travailler sur le reste du produit.
// À la différence de MailgunAdapter, celui-ci peut journaliser le contenu :
// il ne tourne jamais en production, seulement sur un poste de développement.
export class ConsoleMailAdapter implements MailPort {
  private readonly logger = new Logger(ConsoleMailAdapter.name);

  async send(mail: Mail): Promise<void> {
    this.logger.log(`[dev] mail → ${mail.to} (${mail.locale}) : ${mail.subject}\n${mail.text}`);
  }
}
