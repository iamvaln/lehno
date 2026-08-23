import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AppError } from "../src/common/errors.js";
import { ZodValidationPipe } from "../src/common/zod-validation.pipe.js";

const schema = z
  .object({
    username: z.string(),
    role: z.enum(["admin", "member"]),
  })
  .strict();

function transformAndCatch(pipe: ZodValidationPipe, value: unknown): AppError {
  try {
    pipe.transform(value);
    throw new Error("devait lever une AppError");
  } catch (e) {
    if (!(e instanceof AppError)) throw e;
    return e;
  }
}

describe("ZodValidationPipe", () => {
  const pipe = new ZodValidationPipe(schema);

  it("laisse passer un corps valide", () => {
    const value = { username: "alex", role: "admin" };
    expect(pipe.transform(value)).toEqual(value);
  });

  it("un champ manquant fait échouer la requête et nomme le champ dans les détails", () => {
    const err = transformAndCatch(pipe, { role: "admin" });
    expect(err.code).toBe("validation_failed");
    expect(err.details).toHaveProperty("username");
  });

  it("un champ inattendu fait échouer la requête, sans laisser passer inaperçu", () => {
    const err = transformAndCatch(pipe, {
      username: "alex",
      role: "admin",
      oops: "s3cr3t-payload-value",
    });
    expect(err.code).toBe("validation_failed");
    // le nom du champ en trop est signalé...
    expect(JSON.stringify(err.details)).toContain("oops");
    // ...mais jamais la valeur qu'il portait.
    expect(JSON.stringify(err.details)).not.toContain("s3cr3t-payload-value");
  });

  it("une valeur d'énumération invalide nomme le champ sans recopier la valeur reçue", () => {
    const err = transformAndCatch(pipe, { username: "alex", role: "superadmin-secret" });
    expect(err.code).toBe("validation_failed");
    expect(err.details).toHaveProperty("role");
    expect(JSON.stringify(err.details)).not.toContain("superadmin-secret");
  });
});
