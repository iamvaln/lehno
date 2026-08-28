import { describe, expect, it } from "vitest";
import jwt from "jsonwebtoken";
import type { ExecutionContext } from "@nestjs/common";
import { AuthGuard } from "../src/auth/auth.guard.js";
import { TokenService } from "../src/auth/token.service.js";
import { AppError } from "../src/common/errors.js";

const SECRET = "c2VjcmV0LWRlLXRlc3QtMzItb2N0ZXRzLWV4YWN0ZW1lbnQ=";

/* La garde vérifie DEUX choses : la signature du jeton, puis l'état du compte
 * en base (voir auth.guard.ts — un jeton autoportant reste valide quinze
 * minutes après une suspension ou une demande de suppression).
 *
 * Les cas ci-dessous portent sur la première, qui rejette avant toute lecture.
 * Un faux Prisma suffit donc : il n'est atteint que par le dernier cas, et un
 * conteneur Postgres pour vérifier qu'un en-tête absent est refusé serait un
 * harnais monté pour rien. L'état du compte est éprouvé contre une vraie base
 * dans compte-actif.test.ts, là où il y a un compte à mettre dans un état.
 */
function prismaAvecStatut(status: string | null) {
  return {
    user: {
      findUnique: async () => (status === null ? null : { status }),
    },
  } as never;
}
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
  const guard = new AuthGuard(new TokenService({} as never, SECRET), prismaAvecStatut("active"));

  it("refuse une requête sans en-tête Authorization", async () => {
    const { context } = contextWithAuthHeader(undefined);
    await expect(guard.canActivate(context)).rejects.toThrow(AppError);
    await expect(guard.canActivate(context)).rejects.toMatchObject({ code: "unauthorized" });
  });

  it("refuse un en-tête qui n'est pas un jeton Bearer", async () => {
    const { context } = contextWithAuthHeader("Token abc123");
    await expect(guard.canActivate(context)).rejects.toMatchObject({ code: "unauthorized" });
  });

  it("refuse un jeton signé avec une autre clé", async () => {
    const forged = jwt.sign({ sub: "quelqu'un" }, "une-tout-autre-cle-de-signature", { algorithm: "HS256" });
    const { context } = contextWithAuthHeader(`Bearer ${forged}`);
    await expect(guard.canActivate(context)).rejects.toMatchObject({ code: "session_expired" });
  });

  it("refuse un jeton expiré", async () => {
    const expired = jwt.sign({ sub: "awa" }, SECRET, { algorithm: "HS256", expiresIn: -1 });
    const { context } = contextWithAuthHeader(`Bearer ${expired}`);
    await expect(guard.canActivate(context)).rejects.toMatchObject({ code: "session_expired" });
  });

  it("pose req.userId et laisse passer un jeton d'accès valide sur un compte actif", async () => {
    const userId = "11111111-1111-1111-1111-111111111111";
    const token = jwt.sign({ sub: userId }, SECRET, { algorithm: "HS256", expiresIn: 900 });
    const { context, req } = contextWithAuthHeader(`Bearer ${token}`);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(req.userId).toBe(userId);
  });

  /* Le piège gardé : un jeton PARFAITEMENT valide dont le compte a disparu
     entre son émission et son usage. Sans la lecture en base, la garde poserait
     req.userId et laisserait la requête chercher les données d'un compte
     effacé. 401 et non 404 : c'est la session qui ne vaut plus rien, pas la
     ressource demandée qui manque. */
  it("refuse un jeton valide dont le compte n'existe plus", async () => {
    const orphelin = new AuthGuard(new TokenService({} as never, SECRET), prismaAvecStatut(null));
    const token = jwt.sign({ sub: "11111111-1111-1111-1111-111111111111" }, SECRET, { algorithm: "HS256", expiresIn: 900 });
    const { context } = contextWithAuthHeader(`Bearer ${token}`);
    await expect(orphelin.canActivate(context)).rejects.toMatchObject({ code: "unauthorized" });
  });
});
