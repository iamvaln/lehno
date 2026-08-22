import type { PipeTransform } from "@nestjs/common";
import type { ZodIssue, ZodTypeAny } from "zod";
import { AppError } from "./errors.js";

// Décrit le problème et l'attendu — jamais la valeur soumise : elle
// atterrirait dans `details`, puis dans un journal qui capture la réponse.
// (Pour `invalid_type`, `expected`/`received` sont des noms de type, pas des
// valeurs — "string" ou "undefined", jamais le contenu du champ.)
function describeIssue(issue: ZodIssue): string {
  switch (issue.code) {
    case "invalid_type":
      return `expected ${issue.expected}, received ${issue.received}`;
    case "invalid_literal":
      return "does not match the expected literal value";
    case "unrecognized_keys":
      return `unrecognized key(s): ${issue.keys.join(", ")}`;
    case "invalid_union":
      return "does not match any allowed shape";
    case "invalid_union_discriminator":
      return `expected one of: ${issue.options.join(", ")}`;
    case "invalid_enum_value":
      return `expected one of: ${issue.options.join(", ")}`;
    case "invalid_arguments":
      return "invalid arguments";
    case "invalid_return_type":
      return "invalid return type";
    case "invalid_date":
      return "invalid date";
    case "invalid_string":
      return `does not match the expected format (${JSON.stringify(issue.validation)})`;
    case "too_small":
      return `too small (minimum ${issue.inclusive ? "" : "exclusive "}${String(issue.minimum)})`;
    case "too_big":
      return `too big (maximum ${issue.inclusive ? "" : "exclusive "}${String(issue.maximum)})`;
    case "invalid_intersection_types":
      return "does not satisfy every intersected shape";
    case "not_multiple_of":
      return `must be a multiple of ${String(issue.multipleOf)}`;
    case "not_finite":
      return "must be finite";
    case "custom":
      return "failed custom validation";
    default:
      return "invalid value";
  }
}

export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodTypeAny) {}

  transform(value: unknown): unknown {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;
    const details = Object.fromEntries(
      result.error.issues.map((i) => [i.path.join(".") || "(racine)", describeIssue(i)]),
    );
    throw new AppError("validation_failed", "request failed schema validation", details);
  }
}
