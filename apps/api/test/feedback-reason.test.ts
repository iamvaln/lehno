import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { feedbackWrite } from "../src/me/feedback.js";

/**
 * WHY A PRODUCTION DISPLEASED.
 *
 * A thumb down without a reason does not say what to fix, and that is the only
 * thing anyone comes here for. What these tests hold is the shape of the answer
 * — a closed reason that counts, a free note that says what no list foresaw —
 * and the two guards that keep the count honest.
 *
 * **THEY RUN AGAINST A REAL DATABASE ON PURPOSE.** Half of what is checked here
 * lives in CHECK constraints, and a constraint nobody exercises is a comment.
 */
describe("the reason behind a thumb down", () => {
  let db: TestDb;

  beforeAll(async () => { db = await withDatabase(); });
  beforeEach(async () => { await resetDatabase(db.prisma); });

  const aUser = async (): Promise<string> => (await db.prisma.user.create({
    data: {
      email: `${randomBytes(6).toString("hex")}@example.com`,
      username: `u${randomBytes(4).toString("hex")}`,
      referralCode: randomBytes(4).toString("hex").toUpperCase(),
    },
    select: { id: true },
  })).id;

  /* THE SEED SURVIVES THE RESET. It is seeded once by the migration and never
     replayed — if `feedback_reason` ever leaves the reference tables, every
     thumb down in the suite starts failing with `validation_failed`, and the
     cause is three files away from the symptom. */
  it("keeps its reasons across a reset", async () => {
    expect(await db.prisma.feedbackReason.count()).toBeGreaterThan(0);
  });

  it("scopes reasons to the nature that can carry them", async () => {
    const forAPortrait = await db.prisma.feedbackReason.findMany({
      where: { isActive: true, natures: { has: "portrait" } }, select: { code: true },
    });
    const codes = forAPortrait.map((r) => r.code);
    // Une image se juge sur la ressemblance ; un budget n'a rien à y faire.
    expect(codes).toContain("poor_likeness");
    expect(codes).not.toContain("out_of_budget");
  });

  /* A REASON FROM ANOTHER NATURE IS REFUSED. Accepted, "poor likeness" would be
     counted forever under messages, in a column nobody can read — and the panel
     would show a reason that cannot apply as the top complaint. */
  it("refuses a reason that belongs to another nature", async () => {
    await expect(feedbackWrite(db.prisma, "message", {
      feedback: "down", reasonCode: "poor_likeness",
    })).rejects.toMatchObject({ code: "validation_failed" });
  });

  /* A RETIRED REASON IS REFUSED TOO, and this is what a foreign key would NOT
     have caught: the row still exists, so the key would be satisfied. What we
     want is that the reason was still OFFERED at the moment of the click. */
  it("refuses a retired reason, which a foreign key would have let through", async () => {
    await db.prisma.feedbackReason.update({
      where: { code: "bland" }, data: { isActive: false },
    });
    await expect(feedbackWrite(db.prisma, "portrait", {
      feedback: "down", reasonCode: "bland",
    })).rejects.toMatchObject({ code: "validation_failed" });
  });

  it("refuses a code that is in no registry at all", async () => {
    await expect(feedbackWrite(db.prisma, "portrait", {
      feedback: "down", reasonCode: "trop_bleu",
    })).rejects.toMatchObject({ code: "validation_failed" });
  });

  /* TAKING THE THUMB BACK TAKES EVERYTHING WITH IT. A note outliving its verdict
     is a comment on nothing, and it would still be read in the panel, attributed
     to a production nobody judges any more. */
  it("clears the reason and the note when the verdict is taken back", async () => {
    const written = await feedbackWrite(db.prisma, "portrait", { feedback: null });
    expect(written).toEqual({
      feedback: null, feedbackAt: null, feedbackReasonCode: null, feedbackNote: null,
    });
  });

  it("dates the verdict, and only when there is one", async () => {
    const down = await feedbackWrite(db.prisma, "idees", {
      feedback: "down", reasonCode: "out_of_budget", note: "elle a déjà tout ça",
    });
    expect(down.feedbackAt).toBeInstanceOf(Date);
    expect(down.feedbackReasonCode).toBe("out_of_budget");
    expect(down.feedbackNote).toBe("elle a déjà tout ça");
  });

  /* ── CE QUE LA BASE TIENT, ET QUE LE SERVICE NE PEUT PAS GARANTIR SEUL ──
   *
   * Un appelant qui contourne le service — une migration de données, une main
   * dans psql, un second service écrit dans six mois — trouve la même règle. */
  describe("the constraints, exercised rather than assumed", () => {
    const aPortrait = async (userId: string, data: Record<string, unknown>) => {
      const person = await db.prisma.person.create({
        data: { userId, displayName: "Awa" }, select: { id: true },
      });
      const action = await db.prisma.premiumAction.create({
        data: { code: `portrait_${randomBytes(4).toString("hex")}`, label: "portrait", creditCost: 1 },
        select: { id: true },
      });
      const run = await db.prisma.actionRun.create({
        data: { userId, premiumActionId: action.id, status: "success", creditsSpent: 1 },
        select: { id: true },
      });
      return db.prisma.portrait.create({
        data: {
          userId, personId: person.id, actionRunId: run.id,
          content: JSON.stringify({ mots: [], phrase: "trois phrases" }),
          ...data,
        },
      });
    };

    it("refuses a thumb down with no reason", async () => {
      const userId = await aUser();
      await expect(aPortrait(userId, { feedback: "down", feedbackAt: new Date() }))
        .rejects.toThrow(/portrait_motif_si_rejet/);
    });

    /* LE CAS QUE `=` AURAIT LAISSÉ PASSER. Sur un avis nul, `feedback = 'down'`
       vaut NULL, et une contrainte qui vaut NULL est SATISFAITE : la règle
       écrite naïvement aurait accepté un motif sur une production que personne
       ne juge. C'est pour ce cas précis que la contrainte emploie
       `IS NOT DISTINCT FROM`. */
    it("refuses a reason on a production nobody judged", async () => {
      const userId = await aUser();
      await expect(aPortrait(userId, { feedbackReasonCode: "off_topic" }))
        .rejects.toThrow(/portrait_motif_si_rejet/);
    });

    it("refuses a reason on a thumb up", async () => {
      const userId = await aUser();
      await expect(aPortrait(userId, {
        feedback: "up", feedbackAt: new Date(), feedbackReasonCode: "off_topic",
      })).rejects.toThrow(/portrait_motif_si_rejet/);
    });

    it("refuses a note with no verdict behind it", async () => {
      const userId = await aUser();
      await expect(aPortrait(userId, { feedbackNote: "bof" }))
        .rejects.toThrow(/portrait_note_suit_l_avis/);
    });

    it("accepts the shape the API actually writes", async () => {
      const userId = await aUser();
      const written = await aPortrait(userId, {
        feedback: "down", feedbackAt: new Date(),
        feedbackReasonCode: "poor_likeness", feedbackNote: "les yeux ne vont pas",
      });
      expect(written.feedbackReasonCode).toBe("poor_likeness");
    });
  });
});
