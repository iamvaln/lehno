import { describe, expect, it } from "vitest";
import { CONTACT_SUBJECTS, contactSendSchema } from "./public.js";

// Le sujet vient d'une liste fermée de six entrées (voir
// design_handoff_surfaces_publiques/ui_kits/web/pages.html, clé "contact" →
// "sujets") : une valeur libre venue du client ne doit jamais atterrir telle
// quelle dans le courriel envoyé à l'équipe.
describe("contactSendSchema", () => {
  const base = { name: "Awa", email: "awa@example.com", message: "Un message assez long pour passer." };

  it("accepte chacune des six clés fermées", () => {
    for (const subject of CONTACT_SUBJECTS) {
      const r = contactSendSchema.safeParse({ ...base, subject });
      expect(r.success, `"${subject}" devrait être accepté`).toBe(true);
    }
  });

  it("refuse un sujet hors de la liste fermée", () => {
    const r = contactSendSchema.safeParse({ ...base, subject: "un_sujet_invente" });
    expect(r.success).toBe(false);
  });

  it("refuse un message trop court", () => {
    const r = contactSendSchema.safeParse({ ...base, subject: "autre", message: "court" });
    expect(r.success).toBe(false);
  });

  it("refuse un champ inattendu (contrat strict)", () => {
    const r = contactSendSchema.safeParse({ ...base, subject: "autre", oops: true });
    expect(r.success).toBe(false);
  });
});
