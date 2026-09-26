import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { OtpService } from "../src/auth/otp.service.js";

const PEPPER = "dGVzdC1wZXBwZXItMzItb2N0ZXRzLWV4YWN0ZW1lbnQhIQ==";
const REVIEW = { email: "store-review@lehno.io", code: "424242" } as const;

/**
 * THE STORE REVIEW ACCOUNT.
 *
 * Google reviews every release before it is published, and has to get into
 * the app. Sign-in is a code sent by email, so the reviewer — who does not
 * have the mailbox — never gets in, and the release is rejected for "could
 * not access the app".
 *
 * One address therefore receives a code that is known in advance. Everything
 * else is untouched, and these tests are what says so: the code is still
 * hashed, still expires, still burns after five attempts, still single-use.
 * Only the draw stops being random, and only for that address.
 */
describe("the store review account", () => {
  let db: TestDb;
  let otp: OtpService;

  beforeAll(async () => { db = await withDatabase(); }, 120_000);
  afterAll(async () => { await db.close(); });
  beforeEach(async () => {
    await resetDatabase(db.prisma);
    otp = new OtpService(db.prisma as never, PEPPER, REVIEW);
  });

  it("gives the review address the configured code", async () => {
    const { code } = await otp.issue(REVIEW.email, "login");
    expect(code).toBe(REVIEW.code);
  });

  /* THE CODE IS STABLE ACROSS REQUESTS, which is the whole point: the
     reviewer is told the code in the console days before they use it. */
  it("gives the same code every time", async () => {
    const un = await otp.issue(REVIEW.email, "login");
    const deux = await otp.issue(REVIEW.email, "login");
    expect(deux.code).toBe(un.code);
  });

  /* THE CASE THAT MATTERS: nobody else is affected. A fixed code that leaked
     into the ordinary path would hand every account away. */
  it("leaves every other address on a random code", async () => {
    const codes = new Set<string>();
    /* NO `resetDatabase` IN THIS LOOP, and that is not a shortcut: `issue`
       already cancels the previous code for the same address and reason, so a
       clean base buys nothing here. Twelve clones bought eight seconds, which
       is under the timeout alone and over it under the load of the whole
       suite — a test that only passes when run by itself. */
    for (let i = 0; i < 12; i += 1) {
      codes.add((await otp.issue("awa@example.com", "login")).code);
    }
    expect(codes.has(REVIEW.code)).toBe(false);
    expect(codes.size).toBeGreaterThan(1);
  });

  /* Case and Gmail dots must not lock the reviewer out: `issue` receives the
     address exactly as typed, and a capital letter would otherwise fall
     through to the random draw. */
  it("recognises the address whatever its spelling", async () => {
    const { code } = await otp.issue("Store-Review@Lehno.io", "login");
    expect(code).toBe(REVIEW.code);
  });

  /* NO PRIVILEGE BEYOND THE DRAW. The row is written and hashed like any
     other — the plain code never reaches the database. */
  it("stores the fixed code hashed, like any other", async () => {
    await otp.issue(REVIEW.email, "login");
    const row = await db.prisma.otpCode.findFirstOrThrow();
    expect(row.codeHash).not.toContain(REVIEW.code);
    expect(row.codeHash).toMatch(/^v1\$/);
  });

  /* IT IS STILL SINGLE-USE. A reviewer's code that stayed valid after being
     spent would be a permanent key to that account. */
  it("burns the fixed code once it has been used", async () => {
    await otp.issue(REVIEW.email, "login");
    await otp.verify(REVIEW.email, "login", REVIEW.code);
    await expect(otp.verify(REVIEW.email, "login", REVIEW.code)).rejects.toThrow();
  });

  /* WITHOUT THE CONFIGURATION THERE IS NO REVIEW ACCOUNT AT ALL. This is the
     default, and it must stay true everywhere no store requires one. */
  it("draws at random when no review account is configured", async () => {
    const sans = new OtpService(db.prisma as never, PEPPER, null);
    const codes = new Set<string>();
    for (let i = 0; i < 12; i += 1) {
      codes.add((await sans.issue(REVIEW.email, "login")).code);
    }
    expect(codes.has(REVIEW.code)).toBe(false);
  });

  /* A CODE NOBODY CAN TYPE IS WORSE THAN NO REVIEW ACCOUNT: the release is
     rejected anyway, and the misconfiguration is invisible until then. */
  it("refuses to start on a code that is not six digits", () => {
    expect(() => new OtpService(db.prisma as never, PEPPER, { email: REVIEW.email, code: "abc" }))
      .toThrow(/six chiffres/);
  });
});
