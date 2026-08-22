import type { PipeTransform } from "@nestjs/common";
import type { ZodTypeAny } from "zod";
import { AppError } from "./errors.js";

export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodTypeAny) {}

  transform(value: unknown): unknown {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;
    const details = Object.fromEntries(
      result.error.issues.map((i) => [i.path.join(".") || "(racine)", i.message]),
    );
    throw new AppError("validation_failed", "request failed schema validation", details);
  }
}
