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
      // Revue tour 2, point 2 : jamais le destinataire (ni aucun contenu du
      // courrier) dans le journal — masqué à l'écriture, pas retiré après
      // coup. Seuls la nature de l'échec et le code rendu par le
      // prestataire (le statut HTTP) comptent pour diagnostiquer.
      this.logger.error(`mailgun send failed: status=${res.status}`);
      throw new Error(`mailgun send failed with status ${res.status}`);
    }
  }
}

// Ne garde que de quoi confirmer qu'un envoi part, jamais de quoi retrouver
// le destinataire exact dans un journal : premier caractère du nom local,
// domaine intact ("a***@example.com"). Aligné sur la règle déjà appliquée à
// MailgunAdapter ci-dessus — même si celui-ci n'écrit que sur une console de
// développement, pas de raison d'y traiter l'adresse différemment.
function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  return `${email[0]}***${email.slice(at)}`;
}

// Adaptateur de développement : n'existe QUE si l'opérateur a posé
// LEHNO_MAIL_CONSOLE=1 explicitement (voir app.module.ts) — jamais par
// défaut, jamais parce que MAILGUN_API_KEY/MAILGUN_DOMAIN seraient absents
// sans qu'on l'ait demandé. C'est exactement le principe déjà appliqué à
// OtpService/TokenService (refuser de démarrer plutôt que de fonctionner mal
// en silence), reporté ici : le silence d'une configuration ne doit jamais
// se traduire par « écris les secrets dans le journal ».
//
// Choix assumé : le corps du message (donc le code à usage unique) reste
// affiché. C'est la seule raison d'être de cet adaptateur — sans lui,
// développer le parcours de connexion exigerait un compte Mailgun payant,
// ce que le produit refuse d'imposer (voir le brief de la tâche 17). Cette
// sortie ne va nulle part au-delà du terminal du développeur qui a lui-même
// posé la variable ; ce n'est ni un journal applicatif partagé, ni un
// chemin qu'un déploiement pourrait emprunter sans le choisir. Seule
// l'adresse reste masquée : elle n'apporte rien pour vérifier qu'un envoi
// part (l'appelant vient de la saisir lui-même), donc autant s'aligner sur
// la règle du projet par défaut de prudence.
export class ConsoleMailAdapter implements MailPort {
  private readonly logger = new Logger(ConsoleMailAdapter.name);

  async send(mail: Mail): Promise<void> {
    this.logger.log(`[dev] mail → ${maskEmail(mail.to)} (${mail.locale}) : ${mail.subject}\n${mail.text}`);
  }
}
