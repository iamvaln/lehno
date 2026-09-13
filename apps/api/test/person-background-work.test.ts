import { afterEach, describe, expect, it, vi } from "vitest";
import { Logger } from "@nestjs/common";
import { PersonController } from "../src/me/person.controller.js";

/**
 * WORK LAUNCHED AND NOT AWAITED MUST NEVER REJECT.
 *
 * Creating a person fires a count in the background to decide whether this is
 * the FIRST one — the response has already gone out by then, so nobody is left
 * to await that promise. Under Node 22 an unhandled rejection TERMINATES THE
 * PROCESS: a passing database hiccup on a measurement would take the whole API
 * down.
 *
 * It happened for real, in a different disguise: the test harness truncates
 * between cases while this very query was still in flight, PostgreSQL broke the
 * deadlock by killing it, and the release pipeline went red on a build whose
 * 1863 tests had all passed.
 */
describe("the background measurement on person creation", () => {
  const person = {
    id: "11111111-1111-1111-1111-111111111111",
    displayName: "Valery",
    birthDate: null,
    notesCount: 0,
  };

  /** Catches what the process would otherwise die from. */
  const watchUnhandled = (): { seen: unknown[]; stop: () => void } => {
    const seen: unknown[] = [];
    const onRejection = (reason: unknown): void => { seen.push(reason); };
    process.on("unhandledRejection", onRejection);
    return { seen, stop: () => { process.off("unhandledRejection", onRejection); } };
  };

  /** Two macrotasks: enough for a rejection to reach the process. */
  const settle = async (): Promise<void> => {
    await new Promise((done) => setTimeout(done, 0));
    await new Promise((done) => setTimeout(done, 0));
  };

  const controller = (list: () => Promise<unknown>, emit = vi.fn()): PersonController =>
    new PersonController(
      { create: () => Promise.resolve(person), list } as never,
      { emettre: emit } as never,
      {} as never,
    );

  afterEach(() => { vi.restoreAllMocks(); });

  /* THE CASE THAT MATTERS. Break the `.catch()` in the controller and this one
     fails — the rejection reaches the process. */
  it("does not let a failed count reject into the process", async () => {
    vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    const watcher = watchUnhandled();
    try {
      const created = await controller(() => Promise.reject(new Error("database unreachable")))
        .create({ userId: "u" } as never, { displayName: "Valery" } as never);

      expect(created).toMatchObject({ displayName: "Valery" });
      await settle();
      expect(watcher.seen).toEqual([]);
    } finally {
      watcher.stop();
    }
  });

  /* AND THE CREATION ITSELF IS NEVER HELD BACK BY IT. The count is off the
     response path on purpose: paying for it would slow down every creation. */
  it("answers without waiting for the count", async () => {
    let release: (() => void) | undefined;
    const blocked = new Promise<void>((resolve) => { release = resolve; });

    const created = await controller(async () => {
      await blocked;
      return { total: 1 };
    }).create({ userId: "u" } as never, { displayName: "Valery" } as never);

    expect(created).toMatchObject({ displayName: "Valery" });
    release?.();
  });

  /* The measurement still fires when the count says this is the first one —
     the `.catch()` must not have swallowed the happy path. */
  it("still reports the first person", async () => {
    const emit = vi.fn();
    await controller(() => Promise.resolve({ total: 1 }), emit)
      .create({ userId: "u" } as never, { displayName: "Valery" } as never);

    await settle();
    expect(emit).toHaveBeenCalledWith("u", "person.first_created", {});
  });

  it("says nothing when the carnet already held someone", async () => {
    const emit = vi.fn();
    await controller(() => Promise.resolve({ total: 4 }), emit)
      .create({ userId: "u" } as never, { displayName: "Valery" } as never);

    await settle();
    expect(emit).not.toHaveBeenCalledWith("u", "person.first_created", {});
  });
});
