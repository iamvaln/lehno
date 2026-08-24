import { Logger } from "@nestjs/common";
import type { Mail, MailPort } from "./mail.port.js";

// Ne garde que de quoi confirmer qu'un envoi part, jamais de quoi retrouver
// le destinataire exact dans un journal : premier caractère du nom local,
// domaine intact ("a***@example.com"). Aligné sur la règle déjà appliquée à
// ResendAdapter — même si celui-ci n'écrit que sur une console de
// développement, pas de raison d'y traiter l'adresse différemment.
function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  return `${email[0]}***${email.slice(at)}`;
}

// Adaptateur de développement : n'existe QUE si l'opérateur a posé
// LEHNO_MAIL_CONSOLE=1 explicitement (voir app.module.ts) — jamais par
// défaut, jamais parce que RESEND_API_KEY/RESEND_FROM seraient absents
// sans qu'on l'ait demandé. C'est exactement le principe déjà appliqué à
// OtpService/TokenService (refuser de démarrer plutôt que de fonctionner mal
// en silence), reporté ici : le silence d'une configuration ne doit jamais
// se traduire par « écris les secrets dans le journal ».
//
// Choix assumé : le corps du message (donc le code à usage unique) reste
// affiché. C'est la seule raison d'être de cet adaptateur — sans lui,
// développer le parcours de connexion exigerait un compte Resend payant,
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
