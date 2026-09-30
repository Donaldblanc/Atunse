import { describe, expect, it } from "vitest";
import { Money } from "@/shared/money/money";
import { adminStatusMoves, canTransition, isStepBack, liveEstimate, orderRollupStatus } from "./domain";

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

describe("adminStatusMoves", () => {
  const deposit = (status: "PENDING" | "RECEIVED") => ({ payments: [{ kind: "DEPOSIT" as const, status }] });

  it("offers the next step and Cancel", () => {
    expect(adminStatusMoves({ status: "IN_PROGRESS" }, deposit("RECEIVED"))).toEqual({ moves: ["QUALITY_CHECK", "CANCELLED"], held: null });
  });

  it("never offers Quote Sent or Approved as a plain move: each has its own step (ADR-0001); the step back stays", () => {
    expect(adminStatusMoves({ status: "UNDER_REVIEW" }, deposit("RECEIVED"))).toEqual({ moves: ["REQUEST_SUBMITTED", "CANCELLED"], held: null });
    expect(adminStatusMoves({ status: "QUOTE_SENT" }, deposit("RECEIVED"))).toEqual({ moves: ["CANCELLED"], held: null });
  });

  it("tells a step back from progress", () => {
    expect(isStepBack("UNDER_REVIEW", "REQUEST_SUBMITTED")).toBe(true);
    expect(isStepBack("REQUEST_SUBMITTED", "UNDER_REVIEW")).toBe(false);
    expect(isStepBack("UNDER_REVIEW", "CANCELLED")).toBe(false);
  });

  it("holds a pair at Approved while the Deposit is pending (ADR-0002)", () => {
    const { moves, held } = adminStatusMoves({ status: "APPROVED" }, deposit("PENDING"));
    expect(moves).toEqual(["CANCELLED"]);
    expect(held).toMatch(/deposit/);
    expect(adminStatusMoves({ status: "APPROVED" }, deposit("RECEIVED")).moves).toEqual(["AWAITING_SNEAKERS", "CANCELLED"]);
    expect(adminStatusMoves({ status: "APPROVED" }, { payments: [] }).moves).toEqual(["AWAITING_SNEAKERS", "CANCELLED"]);
  });

  it("offers nothing from a finished pair", () => {
    expect(adminStatusMoves({ status: "COMPLETED" }, deposit("RECEIVED"))).toEqual({ moves: [], held: null });
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
