import { randomUUID } from "node:crypto";
import type { NestMiddleware } from "@nestjs/common";
import { Injectable } from "@nestjs/common";

@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  // req/res restent non typés : le middleware doit rester indépendant de la plateforme HTTP (express ou fastify).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  use(req: any, res: any, next: () => void): void {
    const id = req.headers["x-correlation-id"] ?? randomUUID();
    req.correlationId = id;
    res.setHeader("x-correlation-id", id);
    next();
  }
}
