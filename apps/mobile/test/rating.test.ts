import { describe, expect, it } from "vitest";
import { needsReason, ratingCall, reasonsPath, wanted } from "../lib/rating.js";

const ID = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";

describe("what a press means", () => {
  it("sets the thumb that was pressed", () => {
    expect(wanted({ feedback: null }, "up")).toBe("up");
  });

  it("replaces the opposite one without clearing first", () => {
    expect(wanted({ feedback: "down" }, "up")).toBe("up");
  });

  /* A SLIP OF THE FINGER MUST NOT BE FINAL — the contract asks for it, and this
     is where it becomes true for the person pressing. */
  it("removes the opinion when the same thumb is pressed again", () => {
    expect(wanted({ feedback: "up" }, "up")).toBeNull();
  });
});

describe("when the screen must ask why", () => {
  /* THE QUESTION COMES BEFORE THE SEND. Recording the dislike first and asking
     after would leave an opinion without the one thing we came for — and
     someone who closed the question would never be asked again. */
  it("asks on a dislike", () => {
    expect(needsReason("down")).toBe(true);
  });

  it("does not ask on a like, nor on a removal", () => {
    expect(needsReason("up")).toBe(false);
    expect(needsReason(null)).toBe(false);
  });
});

describe("the body the server expects", () => {
  it("carries the reason on a dislike", () => {
    expect(ratingCall("portrait", ID, "down", { code: "not_like_them" }).body)
      .toEqual({ feedback: "down", reasonCode: "not_like_them" });
  });

  it("carries the free note when there is one", () => {
    expect(ratingCall("idees", ID, "down", { code: "off_budget", note: "trop cher" }).body)
      .toEqual({ feedback: "down", reasonCode: "off_budget", note: "trop cher" });
  });

  /* AN EMPTY NOTE IS NOT A NOTE. Sending `""` would record an answer nobody
     gave, and the contract's own minimum would refuse it anyway. */
  it("omits a blank note rather than sending it", () => {
    expect(ratingCall("message", ID, "down", { code: "wrong_tone", note: "   " }).body)
      .toEqual({ feedback: "down", reasonCode: "wrong_tone" });
  });

  /* A LIKE CARRIES NO REASON, and clearing takes everything with it. */
  it("sends a like bare", () => {
    expect(ratingCall("portrait", ID, "up").body).toEqual({ feedback: "up" });
  });

  it("sends a removal bare", () => {
    expect(ratingCall("portrait", ID, null).body).toEqual({ feedback: null });
  });

  it("posts each nature to its own path", () => {
    expect(ratingCall("portrait", ID, "up").path).toBe(`/me/portraits/${ID}/feedback`);
    expect(ratingCall("message", ID, "up").path).toBe(`/me/messages/${ID}/feedback`);
    expect(ratingCall("idees", ID, "up").path).toBe(`/me/ideas/${ID}/feedback`);
  });
});

describe("where the reasons come from", () => {
  /* NEVER FILTERED HERE: "ne lui ressemble pas" means nothing under a message,
     "hors budget" nothing under a portrait. The server knows which is which. */
  it("asks per nature", () => {
    expect(reasonsPath("idees")).toBe("/me/feedback-reasons?nature=idees");
  });
});
