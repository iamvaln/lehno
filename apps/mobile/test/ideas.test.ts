import { describe, expect, it } from "vitest";
import type { GeneratedIdea, GenerationResult } from "@lehno/contracts";
import { keeping, priceLabel, producedIdeas, rating } from "../lib/ideas.js";

const ID = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";
const idea = (over: Partial<GeneratedIdea> = {}): GeneratedIdea => ({
  id: ID, label: "Un carnet", details: null,
  priceMin: null, priceMax: null, currency: null,
  feedback: null, feedbackReasonCode: null, feedbackNote: null, wishlistItemId: null,
  ...over,
});

describe("keeping an idea", () => {
  it("posts to accept while no wish was born from it", () => {
    expect(keeping(idea())).toEqual({ path: `/me/ideas/${ID}/accept`, method: "POST", body: {} });
  });

  /* ONE-WAY. The wish is an object of its own once it exists; undoing from here
     would delete something the owner may have renamed since. */
  it("offers nothing once the idea has become a wish", () => {
    expect(keeping(idea({ wishlistItemId: ID }))).toBeNull();
  });
});

describe("rating an idea", () => {
  it("sets the thumb that was pressed", () => {
    expect(rating(idea(), "up").body).toEqual({ feedback: "up" });
  });

  it("replaces the opposite one without clearing first", () => {
    expect(rating(idea({ feedback: "down" }), "up").body).toEqual({ feedback: "up" });
  });

  /* A SLIP OF THE FINGER MUST NOT BE FINAL — the contract says so, and this is
     where it becomes true for the person pressing. */
  it("removes the opinion when the same thumb is pressed again", () => {
    expect(rating(idea({ feedback: "up" }), "up").body).toEqual({ feedback: null });
  });
});

describe("what the result screen shows", () => {
  const result = (over: Record<string, unknown>): GenerationResult =>
    ({ generation: { status: "succeeded" }, message: null, ideas: null, ...over }) as GenerationResult;

  it("shows the ideas a succeeded run produced", () => {
    const set = { id: ID, occurrenceId: null, ideas: [idea()], createdAt: "" };
    expect(producedIdeas(result({ ideas: set }))).toHaveLength(1);
  });

  /* AN EMPTY SET IS NOT A FAILURE. The run happened, the credit is spent, and
     saying "it failed" would promise a refund that will not come. */
  it("tells an empty set apart from nothing at all", () => {
    const set = { id: ID, occurrenceId: null, ideas: [], createdAt: "" };
    expect(producedIdeas(result({ ideas: set }))).toEqual([]);
    expect(producedIdeas(result({ ideas: null }))).toBeNull();
  });

  it("shows nothing while the run has not succeeded", () => {
    expect(producedIdeas(result({ generation: { status: "running" } }))).toBeNull();
    expect(producedIdeas(null)).toBeNull();
  });
});

describe("how a price reads", () => {
  const T = {
    ideesPrix: (min: string, max: string) => `Entre ${min} et ${max}`,
    ideesPrixMax: (max: string) => `Jusqu'à ${max}`,
  };

  it("shows a range when both bounds are known", () => {
    expect(priceLabel(idea({ priceMin: 20, priceMax: 50, currency: "EUR" }), T))
      .toBe("Entre 20 et 50 EUR");
  });

  it("shows an upper bound alone, because it bounds the effort", () => {
    expect(priceLabel(idea({ priceMax: 50, currency: "EUR" }), T)).toBe("Jusqu'à 50 EUR");
  });

  /* A LONE LOWER BOUND TELLS NOTHING. "From 20" leaves the ceiling open, which
     is the one thing someone choosing a gift needs. */
  it("shows nothing for a lower bound alone", () => {
    expect(priceLabel(idea({ priceMin: 20, currency: "EUR" }), T)).toBeNull();
  });

  /* NO CURRENCY, NO NUMBER. A bare figure would be read in whatever currency
     the reader has in mind. */
  it("shows nothing without a currency", () => {
    expect(priceLabel(idea({ priceMin: 20, priceMax: 50 }), T)).toBeNull();
  });
});
