import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { AdminGuard } from "../src/admin/admin.guard.js";
import { RoleGuard, ROLE_REQUIS } from "../src/admin/role.guard.js";
import { AdminTokenService } from "../src/admin/admin-token.service.js";
import jwt from "jsonwebtoken";
import { AppError } from "../src/common/errors.js";

const SECRET_ADMIN = "Y2xlLWFkbWluLWRlLXRlc3QtMzItb2N0ZXRzLWljaSEh";

type Requete = { headers: Record<string, string>; admin?: { id: string; role: string } };

function contexte(entete?: string): { ctx: ExecutionContext; req: Requete } {
  const req: Requete = { headers: entete === undefined ? {} : { authorization: entete } };
  const ctx = {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
  return { ctx, req };
}

describe("AdminGuard", () => {
  let db: TestDb;
  let jetons: AdminTokenService;
  let garde: AdminGuard;

  beforeAll(async () => {
    db = await withDatabase();
    jetons = new AdminTokenService(db.prisma as never, SECRET_ADMIN);
    garde = new AdminGuard(jetons, db.prisma as never);
  }, 180_000);
  beforeEach(async () => { await resetDatabase(db.prisma); });
  afterAll(async () => { await db.close(); });

  const creerAdmin = (over: Record<string, unknown> = {}) =>
    db.prisma.admin.create({ data: { email: "sam@lehno.app", ...over } });

  it("refuse une requête sans en-tête", async () => {
    await expect(garde.canActivate(contexte().ctx)).rejects.toThrow(AppError);
  });

  it("laisse passer un administrateur actif et pose son rôle", async () => {
    const sam = await creerAdmin({ role: "admin" });
    const { accessToken } = await jetons.ouvrir(sam.id);
    const { ctx, req } = contexte(`Bearer ${accessToken}`);

    await expect(garde.canActivate(ctx)).resolves.toBe(true);
    expect(req.admin).toEqual({ id: sam.id, role: "admin", familyId: expect.any(String) });
  });

  // La lignée voyage avec l'appelant : c'est elle qui permet à « mon profil »
  // de reconnaître la session d'où vient l'appel, et à « fermer les autres
  // sessions » d'épargner la sienne. Sans elle, les deux se feraient au hasard.
  it("pose la lignée de la session d'où vient l'appel", async () => {
    const sam = await creerAdmin({ role: "admin" });
    const une = await jetons.ouvrir(sam.id);
    const autre = await jetons.ouvrir(sam.id);

    const { ctx: ctxUne, req: reqUne } = contexte(`Bearer ${une.accessToken}`);
    const { ctx: ctxAutre, req: reqAutre } = contexte(`Bearer ${autre.accessToken}`);
    await garde.canActivate(ctxUne);
    await garde.canActivate(ctxAutre);

    expect(reqUne.admin.familyId).not.toBe(reqAutre.admin.familyId);
  });

  // Un jeton signé avant que la lignée voyage dans la charge reste valide : on
  // ne coupe pas les sessions ouvertes pour une version. Il ne désigne
  // simplement aucune session, et c'est ce que la garde doit dire.
  it("laisse passer un jeton d'avant la lignée, sans en inventer une", async () => {
    const sam = await creerAdmin({ role: "admin" });
    const ancien = jwt.sign({ sub: sam.id, typ: "adm" }, SECRET_ADMIN, {
      expiresIn: 600, algorithm: "HS256",
    });
    const { ctx, req } = contexte(`Bearer ${ancien}`);

    await expect(garde.canActivate(ctx)).resolves.toBe(true);
    expect(req.admin.familyId).toBeNull();
  });

  // Le jeton reste valide trente minutes. Désactiver un compte doit le couper
  // tout de suite, sans attendre l'expiration : c'est le geste qu'on pose quand
  // quelqu'un quitte l'équipe, et il ne souffre pas d'attendre.
  it("refuse un compte désactivé, même avec un jeton encore valide", async () => {
    const sam = await creerAdmin();
    const { accessToken } = await jetons.ouvrir(sam.id);
    await db.prisma.admin.update({ where: { id: sam.id }, data: { isActive: false } });

    await expect(garde.canActivate(contexte(`Bearer ${accessToken}`).ctx)).rejects.toThrow(AppError);
  });

  // La troisième barrière, après la clé de signature et la marque de type : un
  // identifiant qui ne désigne aucun administrateur ne passe pas, quand bien
  // même sa signature serait bonne.
  it("refuse un jeton dont le sujet ne désigne aucun administrateur", async () => {
    const sam = await creerAdmin();
    const { accessToken } = await jetons.ouvrir(sam.id);
    await db.prisma.admin.delete({ where: { id: sam.id } });

    await expect(garde.canActivate(contexte(`Bearer ${accessToken}`).ctx)).rejects.toThrow(AppError);
  });
});

describe("RoleGuard", () => {
  const reflector = new Reflector();
  const garde = new RoleGuard(reflector);

  function contexteAvecRole(role: string, requis?: string): ExecutionContext {
    const req: Requete = { headers: {}, admin: { id: "x", role } };
    const handler = () => undefined;
    if (requis) Reflect.defineMetadata(ROLE_REQUIS, requis, handler);
    return {
      switchToHttp: () => ({ getRequest: () => req }),
      getHandler: () => handler,
      getClass: () => class {},
    } as unknown as ExecutionContext;
  }

  it("laisse passer quand la route n'exige aucun rôle", () => {
    expect(garde.canActivate(contexteAvecRole("support"))).toBe(true);
  });

  it("refuse un support sur une route réservée aux administrateurs", () => {
    expect(() => garde.canActivate(contexteAvecRole("support", "admin"))).toThrow(
      expect.objectContaining({ code: "forbidden" }),
    );
  });

  it("laisse passer un administrateur sur une route réservée", () => {
    expect(garde.canActivate(contexteAvecRole("admin", "admin"))).toBe(true);
  });
});
