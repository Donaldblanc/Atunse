import { describe, expect, it } from "vitest";
import { canTransition, orderRollupStatus } from "./domain";

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

  it("rejects moving backward", () => {
    expect(canTransition("QUOTE_SENT", "UNDER_REVIEW")).toBe(false);
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
