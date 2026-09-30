import { describe, expect, it } from "vitest";
import { Money } from "@/shared/money/money";
import { canTransition, liveEstimate, orderRollupStatus } from "./domain";

describe("Item status pipeline", () => {
  it("allows the next linear step", () => {
    expect(canTransition("UNDER_REVIEW", "QUOTE_SENT")).toBe(true);
  });

  it("allows cancellation from any non-terminal state", () => {
    expect(canTransition("IN_PROGRESS", "CANCELLED")).toBe(true);
    expect(canTransition("REQUEST_SUBMITTED", "CANCELLED")).toBe(true);
  });

  it("rejects skipping ahead in the pipeline", () => {
    expect(canTransition("REQUEST_SUBMITTED", "APPROVED")).toBe(false);
  });

  it("allows returning an Item from Under Review to Request Submitted", () => {
    expect(canTransition("UNDER_REVIEW", "REQUEST_SUBMITTED")).toBe(true);
  });

  it("rejects any other move backward", () => {
    expect(canTransition("QUOTE_SENT", "UNDER_REVIEW")).toBe(false);
    expect(canTransition("QUOTE_SENT", "REQUEST_SUBMITTED")).toBe(false);
    expect(canTransition("IN_PROGRESS", "QUALITY_CHECK")).toBe(true);
    expect(canTransition("QUALITY_CHECK", "IN_PROGRESS")).toBe(false);
  });

  it("has no transitions out of terminal states", () => {
    expect(canTransition("COMPLETED", "CANCELLED")).toBe(false);
    expect(canTransition("CANCELLED", "UNDER_REVIEW")).toBe(false);
  });
});

describe("orderRollupStatus", () => {
  it("is the least-advanced pair that isn't cancelled", () => {
    expect(orderRollupStatus([{ status: "IN_PROGRESS" }, { status: "QUOTE_SENT" }, { status: "CANCELLED" }])).toBe("QUOTE_SENT");
    expect(orderRollupStatus([{ status: "COMPLETED" }, { status: "CANCELLED" }])).toBe("COMPLETED");
  });

  it("is Cancelled only when every pair is", () => {
    expect(orderRollupStatus([{ status: "CANCELLED" }, { status: "CANCELLED" }])).toBe("CANCELLED");
  });
});

describe("liveEstimate", () => {
  const pair = (status: "IN_PROGRESS" | "CANCELLED", cents: number) => ({ status, estimate: Money.fromCents(cents) }) as never;

  it("drops cancelled pairs' share but keeps order-level charges like Rush", () => {
    // Two $30 pairs plus a $20 Rush fee; one pair cancelled.
    expect(liveEstimate({ estimate: Money.fromCents(8000), items: [pair("IN_PROGRESS", 3000), pair("CANCELLED", 3000)] }).cents).toBe(5000);
  });

  it("is nothing for a fully cancelled Order", () => {
    expect(liveEstimate({ estimate: Money.fromCents(5000), items: [pair("CANCELLED", 3000)] }).cents).toBe(0);
  });
});
