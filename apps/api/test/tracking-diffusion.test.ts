import { describe, expect, it, vi } from "vitest";
import { Logger } from "@nestjs/common";
import { DiffusionTrackingAdapter } from "../src/tracking/diffusion.adapter.js";
import type { EvenementSortant, TrackingPort } from "../src/tracking/tracking.port.js";

/**
 * SEVERAL DESTINATIONS FOR ONE EVENT.
 *
 * The choice used to be exclusive: with a PostHog key set, the console was
 * never used. The two answer different questions — PostHog keeps events and
 * makes them searchable, the console says RIGHT NOW what went out. On a
 * sandbox driven from a phone you want both, and it is the only way to know a
 * gesture actually emitted.
 *
 * The reason this is a class rather than two awaits is the failure case: one
 * destination down must not take the others with it.
 */
describe("the tracking fan-out", () => {
  const EVENT: EvenementSortant = {
    name: "person.created",
    properties: { origin: "manual" },
    common: { userId: "u-1", clientId: "mobile_android_staging_97d6f5cd" },
  } as never;

  const spy = (): { port: TrackingPort; seen: EvenementSortant[] } => {
    const seen: EvenementSortant[] = [];
    return { seen, port: { capture: async (e) => { seen.push(e); } } };
  };

  it("hands the event to every destination", async () => {
    const a = spy(); const b = spy();
    await new DiffusionTrackingAdapter([a.port, b.port]).capture(EVENT);

    expect(a.seen).toHaveLength(1);
    expect(b.seen).toHaveLength(1);
    expect(a.seen[0]?.name).toBe("person.created");
  });

  /* THE CASE THAT MATTERS. PostHog unreachable must not remove the console
     line — that would lose the witness at the exact moment it is useful. */
  it("keeps the others when one destination fails", async () => {
    vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    const casse: TrackingPort = { capture: async () => { throw new Error("posthog down"); } };
    const vivant = spy();

    await expect(
      new DiffusionTrackingAdapter([casse, vivant.port]).capture(EVENT),
    ).resolves.toBeUndefined();

    expect(vivant.seen).toHaveLength(1);
    vi.restoreAllMocks();
  });

  /* IT NAMES WHAT FAILED. Without this line a mute destination would stay
     mute — and nobody would look for an event that seemed to have gone. */
  it("names the destination that refused the event", async () => {
    const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    class PortHS implements TrackingPort {
      async capture(): Promise<void> { throw new Error("posthog down"); }
    }

    await new DiffusionTrackingAdapter([new PortHS()]).capture(EVENT);

    expect(warn).toHaveBeenCalledWith(expect.stringContaining("PortHS"));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("posthog down"));
    vi.restoreAllMocks();
  });

  /* IT NEVER THROWS, whatever happens. The caller decided long ago that a
     measurement must not break what it measures — `TrackingService.emettre`
     fires without awaiting, so a rejection here would reach nobody and, under
     Node 22, would terminate the process. */
  it("never rejects, even when every destination fails", async () => {
    vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    const casse: TrackingPort = { capture: async () => { throw new Error("tout est par terre"); } };

    await expect(
      new DiffusionTrackingAdapter([casse, casse]).capture(EVENT),
    ).resolves.toBeUndefined();
    vi.restoreAllMocks();
  });

  /* THEY START TOGETHER, not one after the other: a slow destination would
     otherwise add its delay to the next one. */
  it("does not wait for one destination before starting the next", async () => {
    let libere: (() => void) | undefined;
    const lent: TrackingPort = {
      capture: () => new Promise<void>((resolve) => { libere = resolve; }),
    };
    const rapide = spy();

    const encours = new DiffusionTrackingAdapter([lent, rapide.port]).capture(EVENT);
    await Promise.resolve();

    expect(rapide.seen).toHaveLength(1);   // parti sans attendre le lent
    libere?.();
    await encours;
  });
});
