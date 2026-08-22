import type { ArgumentsHost, ExceptionFilter } from "@nestjs/common";
import { Catch, HttpException, Logger } from "@nestjs/common";
import type { ErrorCode, ErrorEnvelope } from "@lehno/contracts";

const STATUS: Partial<Record<ErrorCode, number>> = {
  validation_failed: 400, waitlist_email_invalid: 400,
  unauthorized: 401, session_expired: 401, refresh_reused: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409, username_taken: 409, federated_already_linked: 409,
  rate_limited: 429, otp_rate_limited: 429,
  internal_error: 500,
};

// 422 par défaut : une règle métier non satisfaite, requête pourtant bien formée.
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
      const code: ErrorCode = exception.getStatus() === 404 ? "not_found" : "validation_failed";
      res.status(exception.getStatus()).json({ code, message: exception.message });
      return;
    }
    // Rien de l'incident ne descend au client : il pourrait porter du contenu.
    this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    res.status(500).json({ code: "internal_error", message: "unexpected error" });
  }
}
