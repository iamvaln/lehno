import type { ArgumentsHost } from "@nestjs/common";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError, AppExceptionFilter, statusForCode } from "../src/common/errors.js";
import { errorEnvelopeSchema } from "@lehno/contracts";

describe("erreurs", () => {
  it("l'enveloppe rendue est conforme au contrat", () => {
    const e = new AppError("otp_expired", "otp expired");
    expect(errorEnvelopeSchema.safeParse(e.toEnvelope()).success).toBe(true);
  });

  it("chaque code porte le statut que la spécification lui donne", () => {
    expect(statusForCode("validation_failed")).toBe(400);
    expect(statusForCode("unauthorized")).toBe(401);
    expect(statusForCode("forbidden")).toBe(403);
    expect(statusForCode("not_found")).toBe(404);
    expect(statusForCode("conflict")).toBe(409);
    expect(statusForCode("otp_expired")).toBe(422);
    expect(statusForCode("rate_limited")).toBe(429);
    expect(statusForCode("internal_error")).toBe(500);
  });

  it("le message reste destiné au journal, jamais à l'écran", () => {
    const e = new AppError("username_taken", "username already in use");
    expect(e.toEnvelope().message).toBe("username already in use");
    expect(e.toEnvelope().code).toBe("username_taken");
  });

  it("les trois statuts tranchés par la revue sont respectés", () => {
    // échec d'authentification, comme refresh_reused
    expect(statusForCode("federated_token_invalid")).toBe(401);
    // on sait qui vous êtes, l'accès est refusé — pas une requête corrigeable
    expect(statusForCode("account_suspended")).toBe(403);
    expect(statusForCode("account_pending_deletion")).toBe(403);
    // le code est brûlé, il faut en redemander un : règle métier, pas une limite de débit
    expect(statusForCode("otp_too_many_attempts")).toBe(422);
    expect(statusForCode("otp_rate_limited")).toBe(429);
  });
});

// Hôte Nest minimal : le filtre n'utilise que switchToHttp().getResponse().
function mockHost(): { host: ArgumentsHost; res: { statusCode?: number; body?: unknown } } {
  const res: { statusCode?: number; body?: unknown } = {};
  const response = {
    status(code: number) {
      res.statusCode = code;
      return this;
    },
    json(body: unknown) {
      res.body = body;
      return this;
    },
  };
  const host = {
    switchToHttp: () => ({ getResponse: () => response }),
  } as unknown as ArgumentsHost;
  return { host, res };
}

describe("AppExceptionFilter", () => {
  const filter = new AppExceptionFilter();

  beforeEach(() => {
    // Les avertissements/erreurs attendus ne doivent pas polluer la sortie des tests.
    vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
  });

  it("une AppError rend son enveloppe telle quelle", () => {
    const { host, res } = mockHost();
    filter.catch(new AppError("otp_expired", "otp expired"), host);
    expect(res.statusCode).toBe(422);
    expect(res.body).toEqual({ code: "otp_expired", message: "otp expired" });
  });

  it("une HttpException du framework rend le code qui correspond à son statut réel, jamais validation_failed par défaut", () => {
    const secret = "token=abcd1234 for user@example.com";

    const cases: Array<[HttpException, number, string]> = [
      [new BadRequestException(secret), 400, "validation_failed"],
      [new UnauthorizedException(secret), 401, "unauthorized"],
      [new ForbiddenException(secret), 403, "forbidden"],
      [new NotFoundException(secret), 404, "not_found"],
      [new ConflictException(secret), 409, "conflict"],
      [new HttpException(secret, 429), 429, "rate_limited"],
    ];

    for (const [exception, status, code] of cases) {
      const { host, res } = mockHost();
      filter.catch(exception, host);
      expect(res.statusCode).toBe(status);
      expect((res.body as { code: string }).code).toBe(code);
      // rien du message d'origine — potentiellement porteur de contenu de la requête — ne franchit la frontière.
      expect(JSON.stringify(res.body)).not.toContain(secret);
    }
  });

  it("une exception inattendue ne laisse fuir ni son message ni sa trace", () => {
    const secret = "note content that must never reach the client";
    const { host, res } = mockHost();
    filter.catch(new Error(secret), host);
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ code: "internal_error", message: "unexpected error" });
    expect(JSON.stringify(res.body)).not.toContain(secret);
  });
});
