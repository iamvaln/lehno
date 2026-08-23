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
  const middleware = new CorrelationMiddleware();

  it("reprend un identifiant client déjà en forme d'UUID", () => {
    const id = "0d0a1e2c-1111-4222-8333-444455556666";
    const { req, res, setHeaders } = mockReqRes({ "x-correlation-id": id });
    const next = vi.fn();

    middleware.use(req, res, next);

    expect(req.correlationId).toBe(id);
    expect(setHeaders["x-correlation-id"]).toBe(id);
    expect(next).toHaveBeenCalledOnce();
  });

  it("génère un identifiant neuf quand l'en-tête est absent", () => {
    const { req, res, setHeaders } = mockReqRes({});
    const next = vi.fn();

    middleware.use(req, res, next);

    expect(req.correlationId).toMatch(UUID_PATTERN);
    expect(setHeaders["x-correlation-id"]).toBe(req.correlationId);
    expect(next).toHaveBeenCalledOnce();
  });

  it("un en-tête forgé (retour à la ligne injecté) est remplacé, jamais recopié", () => {
    const forged = "abc\r\nX-Injected: evil";
    const { req, res, setHeaders } = mockReqRes({ "x-correlation-id": forged });
    const next = vi.fn();

    middleware.use(req, res, next);

    expect(req.correlationId).toMatch(UUID_PATTERN);
    expect(req.correlationId).not.toBe(forged);
    expect(setHeaders["x-correlation-id"]).not.toBe(forged);
    expect(next).toHaveBeenCalledOnce();
  });

  it("ne lève jamais, même si la requête est malformée (en-tête répété)", () => {
    const { req, res, setHeaders } = mockReqRes({ "x-correlation-id": ["a", "b"] });
    const next = vi.fn();

    expect(() => middleware.use(req, res, next)).not.toThrow();
    expect(req.correlationId).toMatch(UUID_PATTERN);
    expect(setHeaders["x-correlation-id"]).toBe(req.correlationId);
    expect(next).toHaveBeenCalledOnce();
  });

  it("ne lève jamais et appelle quand même next() si la requête ne porte pas d'en-têtes exploitables", () => {
    const req = {} as { headers?: unknown; correlationId?: string };
    const res = { setHeader: vi.fn() };
    const next = vi.fn();

    expect(() => middleware.use(req, res, next)).not.toThrow();
    expect(req.correlationId).toMatch(UUID_PATTERN);
    expect(next).toHaveBeenCalledOnce();
  });
});
