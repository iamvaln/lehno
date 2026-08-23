import { describe, expect, it } from "vitest";
import jwt from "jsonwebtoken";
import type { ExecutionContext } from "@nestjs/common";
import { AuthGuard } from "../src/auth/auth.guard.js";
import { TokenService } from "../src/auth/token.service.js";
import { AppError } from "../src/common/errors.js";

const SECRET = "c2VjcmV0LWRlLXRlc3QtMzItb2N0ZXRzLWV4YWN0ZW1lbnQ=";

// La garde ne touche jamais la base : verifyAccess() ne fait que vérifier une
// signature JWT. Un TokenService construit sans Prisma réel suffit donc ici —
// pas besoin du harnais testcontainers pour ces cas.
function contextWithAuthHeader(header?: string): { context: ExecutionContext; req: { headers: Record<string, string>; userId?: string } } {
  const req: { headers: Record<string, string>; userId?: string } = {
    headers: header === undefined ? {} : { authorization: header },
  };
  const context = {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
  return { context, req };
}

describe("AuthGuard", () => {
  const guard = new AuthGuard(new TokenService({} as never, SECRET));

  it("refuse une requête sans en-tête Authorization", () => {
    const { context } = contextWithAuthHeader(undefined);
    expect(() => guard.canActivate(context)).toThrow(AppError);
    expect(() => guard.canActivate(context)).toThrow(
      expect.objectContaining({ code: "unauthorized" }),
    );
  });

  it("refuse un en-tête qui n'est pas un jeton Bearer", () => {
    const { context } = contextWithAuthHeader("Token abc123");
    expect(() => guard.canActivate(context)).toThrow(
      expect.objectContaining({ code: "unauthorized" }),
    );
  });

  it("refuse un jeton signé avec une autre clé", () => {
    const forged = jwt.sign({ sub: "quelqu'un" }, "une-tout-autre-cle-de-signature", { algorithm: "HS256" });
    const { context } = contextWithAuthHeader(`Bearer ${forged}`);
    expect(() => guard.canActivate(context)).toThrow(
      expect.objectContaining({ code: "session_expired" }),
    );
  });

  it("refuse un jeton expiré", () => {
    const expired = jwt.sign({ sub: "awa" }, SECRET, { algorithm: "HS256", expiresIn: -1 });
    const { context } = contextWithAuthHeader(`Bearer ${expired}`);
    expect(() => guard.canActivate(context)).toThrow(
      expect.objectContaining({ code: "session_expired" }),
    );
  });

  it("pose req.userId et laisse passer un jeton d'accès valide", () => {
    const userId = "11111111-1111-1111-1111-111111111111";
    const token = jwt.sign({ sub: userId }, SECRET, { algorithm: "HS256", expiresIn: 900 });
    const { context, req } = contextWithAuthHeader(`Bearer ${token}`);
    expect(guard.canActivate(context)).toBe(true);
    expect(req.userId).toBe(userId);
  });
});
