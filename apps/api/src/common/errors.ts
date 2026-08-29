import type { ArgumentsHost, ExceptionFilter } from "@nestjs/common";
import { Catch, HttpException, Logger } from "@nestjs/common";
import type { ErrorCode, ErrorEnvelope } from "@lehno/contracts";

const STATUS: Partial<Record<ErrorCode, number>> = {
  validation_failed: 400, waitlist_email_invalid: 400, contact_invalid: 400,
  // Le motif manque ou ne dit rien : la requête est bien formée, la règle non
  // satisfaite — 422, comme les autres règles métier.
  reason_required: 422,
  // Le code retenu n'existe pas, ne se propose plus, ou ne s'applique pas à ce
  // geste. Distinct de `validation_failed` : la requête est bien formée, c'est
  // la valeur qui ne veut rien dire là où elle est posée.
  reason_code_unknown: 422,
  unauthorized: 401, session_expired: 401, refresh_reused: 401, federated_token_invalid: 401,
  forbidden: 403, account_suspended: 403, account_pending_deletion: 403,
  not_found: 404,
  conflict: 409, username_taken: 409, federated_already_linked: 409,
  // 410, seul de tout le contrat. Un lien de collecte révoqué a existé : le
  // visiteur l'a reçu de quelqu'un, et un 404 lui ferait croire qu'il a mal
  // recopié l'adresse. Un jeton INCONNU, lui, reste un 404 — dire « révoqué »
  // sur un jeton tiré au hasard ferait de ce chemin un oracle à jetons.
  link_revoked: 410,
  rate_limited: 429, otp_rate_limited: 429,
  internal_error: 500,
  // 503 : la ressource existe, elle est momentanément fermée. Voir
  // maintenance/maintenance.guard.ts — surtout pas 404, qui ferait lire un
  // arrêt de deux heures comme une suppression.
  maintenance: 503,
  // Même statut que maintenance, sens différent : ce n'est pas l'API qui est
  // fermée, c'est le fournisseur d'IA qui ne répond pas. Le client réessaie ;
  // il ne masque pas l'écran.
  generation_unavailable: 503,
};

// 422 par défaut : une règle métier non satisfaite, requête pourtant bien formée.
// otp_too_many_attempts y reste explicitement : le code est brûlé, il faut en
// redemander un — à distinguer de otp_rate_limited (429), qui dit d'attendre.
export function statusForCode(code: ErrorCode): number {
  return STATUS[code] ?? 422;
}

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) { super(message); }

  get status(): number { return statusForCode(this.code); }

  toEnvelope(): ErrorEnvelope {
    return this.details
      ? { code: this.code, message: this.message, details: this.details }
      : { code: this.code, message: this.message };
  }
}

// Les exceptions du framework (gardes, tuyaux internes, routage) portent un
// statut fiable mais un message qui peut citer un fragment de la requête.
// On fait correspondre le code au statut réel ; le message d'origine ne
// franchit jamais la frontière — seul le journal le reçoit.
function codeForHttpStatus(status: number): ErrorCode {
  switch (status) {
    case 401: return "unauthorized";
    case 403: return "forbidden";
    case 404: return "not_found";
    case 409: return "conflict";
    case 429: return "rate_limited";
    default: return status >= 500 ? "internal_error" : "validation_failed";
  }
}

@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger("http");

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse();
    if (exception instanceof AppError) {
      this.logger.warn(`${exception.code}: ${exception.message}`);
      res.status(exception.status).json(exception.toEnvelope());
      return;
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const code = codeForHttpStatus(status);
      this.logger.warn(`${code} (framework, ${status}): ${exception.message}`);
      res.status(status).json({ code, message: "request rejected by the framework" });
      return;
    }
    // Rien de l'incident ne descend au client : il pourrait porter du contenu.
    this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    res.status(500).json({ code: "internal_error", message: "unexpected error" });
  }
}
