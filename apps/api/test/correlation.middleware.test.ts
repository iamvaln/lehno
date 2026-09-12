import { describe, expect, it, vi } from "vitest";
import { CorrelationMiddleware } from "../src/common/correlation.middleware.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function mockReqRes(headers: Record<string, unknown>) {
  const setHeaders: Record<string, unknown> = {};
  const req = { headers, correlationId: undefined as string | undefined };
  const res = {
    setHeader(name: string, value: unknown) {
      setHeaders[name] = value;
    },
  };
  return { req, res, setHeaders };
}

describe("CorrelationMiddleware", () => {
  /* UN DOUBLE QUI NE RÉSOUT RIEN. Ces cas éprouvent la corrélation, pas la
     reconnaissance du client — et le middleware ne doit jamais faire échouer une
     requête, quoi que le service réponde. Le cas de la résolution vit dans
     `client-api.test.ts`. */
  const clients = { resoudre: async () => ({ etat: "absent" as const }) };
  const middleware = new CorrelationMiddleware(clients as never);

  it("reprend un identifiant client déjà en forme d'UUID", async () => {
    const id = "0d0a1e2c-1111-4222-8333-444455556666";
    const { req, res, setHeaders } = mockReqRes({ "x-correlation-id": id });
    const next = vi.fn();

    await middleware.use(req, res, next);

    expect(req.correlationId).toBe(id);
    expect(setHeaders["x-correlation-id"]).toBe(id);
    expect(next).toHaveBeenCalledOnce();
  });

  it("génère un identifiant neuf quand l'en-tête est absent", async () => {
    const { req, res, setHeaders } = mockReqRes({});
    const next = vi.fn();

    await middleware.use(req, res, next);

    expect(req.correlationId).toMatch(UUID_PATTERN);
    expect(setHeaders["x-correlation-id"]).toBe(req.correlationId);
    expect(next).toHaveBeenCalledOnce();
  });

  it("un en-tête forgé (retour à la ligne injecté) est remplacé, jamais recopié", async () => {
    const forged = "abc\r\nX-Injected: evil";
    const { req, res, setHeaders } = mockReqRes({ "x-correlation-id": forged });
    const next = vi.fn();

    await middleware.use(req, res, next);

    expect(req.correlationId).toMatch(UUID_PATTERN);
    expect(req.correlationId).not.toBe(forged);
    expect(setHeaders["x-correlation-id"]).not.toBe(forged);
    expect(next).toHaveBeenCalledOnce();
  });

  it("ne lève jamais, même si la requête est malformée (en-tête répété)", async () => {
    const { req, res, setHeaders } = mockReqRes({ "x-correlation-id": ["a", "b"] });
    const next = vi.fn();

    /* `use` EST DEVENUE ASYNCHRONE : `expect(() => …).not.toThrow()` passerait
       désormais même si elle rejetait, puisque le rejet arrive après le retour.
       On attend la promesse — sinon ce cas ne garde plus rien. */
    await expect(middleware.use(req, res, next)).resolves.toBeUndefined();
    expect(req.correlationId).toMatch(UUID_PATTERN);
    expect(setHeaders["x-correlation-id"]).toBe(req.correlationId);
    expect(next).toHaveBeenCalledOnce();
  });

  it("ne lève jamais et appelle quand même next() si la requête ne porte pas d'en-têtes exploitables", async () => {
    const req = {} as { headers?: unknown; correlationId?: string };
    const res = { setHeader: vi.fn() };
    const next = vi.fn();

    /* `use` EST DEVENUE ASYNCHRONE : `expect(() => …).not.toThrow()` passerait
       désormais même si elle rejetait, puisque le rejet arrive après le retour.
       On attend la promesse — sinon ce cas ne garde plus rien. */
    await expect(middleware.use(req, res, next)).resolves.toBeUndefined();
    expect(req.correlationId).toMatch(UUID_PATTERN);
    expect(next).toHaveBeenCalledOnce();
  });
});
