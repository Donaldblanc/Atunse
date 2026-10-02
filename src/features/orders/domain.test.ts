import { describe, expect, it } from "vitest";
import { Money } from "@/shared/money/money";
import { adminStatusMoves, balanceDue, canTransition, isStepBack, liveEstimate, orderRollupStatus, planBalance, planVisitMoves, type ItemStatus, type Payment } from "./domain";
import { RUSH_FEE_CENTS } from "./service-catalog";

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

const cents = (value: number) => Money.fromCents(value);
const pay = (kind: Payment["kind"], status: Payment["status"], amount = 1000) => ({ kind, status, amount: cents(amount), method: "CASH" as const });
const quoted = (status: ItemStatus, price: number | null = 5000) => ({ status, price: price === null ? null : cents(price) });
const orderOf = (payments: ReturnType<typeof pay>[], items: ReturnType<typeof quoted>[] = [quoted("IN_PROGRESS")]) => ({ rush: false, items, payments });

describe("adminStatusMoves", () => {
  const deposit = (status: "PENDING" | "RECEIVED") => orderOf([pay("DEPOSIT", status)]);

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
    expect(adminStatusMoves({ status: "APPROVED" }, orderOf([])).moves).toEqual(["AWAITING_SNEAKERS", "CANCELLED"]);
  });

  describe("Completed hold (ADR-0002)", () => {
    const ready = quoted("READY_FOR_PICKUP_SHIPPING");
    const completed = (order: ReturnType<typeof orderOf>) => adminStatusMoves({ status: "READY_FOR_PICKUP_SHIPPING" }, order);

    it("holds a pair readied early while another pair isn't ready, since the Balance isn't due yet", () => {
      const result = completed(orderOf([pay("DEPOSIT", "RECEIVED")], [ready, quoted("IN_PROGRESS")]));
      expect(result.moves).toEqual(["CANCELLED"]);
      expect(result.held).toBe("Collected once every pair is ready; the Balance is due then.");
    });

    it("holds Completed while the Balance is PENDING", () => {
      const result = completed(orderOf([pay("DEPOSIT", "RECEIVED"), pay("BALANCE", "PENDING", 4000)], [ready]));
      expect(result.moves).toEqual(["CANCELLED"]);
      expect(result.held).toMatch(/^Balance not collected yet/);
    });

    it("allows Completed once the Balance is RECEIVED", () => {
      expect(completed(orderOf([pay("DEPOSIT", "RECEIVED"), pay("BALANCE", "RECEIVED", 4000)], [ready]))).toEqual({ moves: ["COMPLETED", "CANCELLED"], held: null });
    });

    it("allows Completed when every live pair is quoted and the Deposit covers the total", () => {
      expect(completed(orderOf([pay("DEPOSIT", "RECEIVED", 5000)], [ready, quoted("CANCELLED", null)])).moves).toEqual(["COMPLETED", "CANCELLED"]);
      expect(completed(orderOf([pay("DEPOSIT", "RECEIVED", 5000)], [ready, quoted("IN_PROGRESS", 100)])).held).toMatch(/every pair is ready/);
    });
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

describe("balanceDue and planBalance", () => {
  const cents = (value: number) => Money.fromCents(value);
  const payment = (kind: Payment["kind"], status: Payment["status"], amount: number, id = `pay_${kind}`) => ({ id, kind, status, method: "CASH" as const, amount: cents(amount) });
  const pair = (status: ItemStatus, price: number | null) => ({ status, price: price === null ? null : cents(price) });
  const order = (items: ReturnType<typeof pair>[], payments: ReturnType<typeof payment>[], rush = false) => ({ rush, items, payments });

  it("is the quoted total, Rush included, less the Deposit; null while a live pair is unquoted", () => {
    expect(balanceDue(order([pair("READY_FOR_PICKUP_SHIPPING", 9000)], [payment("DEPOSIT", "RECEIVED", 4000)]))).toEqual(cents(5000));
    expect(balanceDue(order([pair("READY_FOR_PICKUP_SHIPPING", 9000)], [payment("DEPOSIT", "RECEIVED", 4000)], true))).toEqual(cents(5000 + RUSH_FEE_CENTS));
    expect(balanceDue(order([pair("READY_FOR_PICKUP_SHIPPING", 9000), pair("IN_PROGRESS", null)], []))).toBeNull();
    expect(balanceDue(order([pair("READY_FOR_PICKUP_SHIPPING", 9000), pair("CANCELLED", null)], [payment("DEPOSIT", "RECEIVED", 4000)]))).toEqual(cents(5000));
  });

  it("creates a PENDING Balance with the Deposit's method once every live pair is ready, and not before", () => {
    const deposit = payment("DEPOSIT", "RECEIVED", 4000);
    expect(planBalance(order([pair("READY_FOR_PICKUP_SHIPPING", 9000), pair("QUALITY_CHECK", 3000)], [deposit]))).toEqual({ type: "none" });
    expect(planBalance(order([pair("READY_FOR_PICKUP_SHIPPING", 9000), pair("CANCELLED", 3000)], [deposit]))).toEqual({ type: "create", amount: cents(5000), method: "CASH" });
  });

  it("creates nothing when the Deposit covers the total", () => {
    expect(planBalance(order([pair("READY_FOR_PICKUP_SHIPPING", 4000)], [payment("DEPOSIT", "RECEIVED", 4000)]))).toEqual({ type: "none" });
    expect(planBalance(order([pair("READY_FOR_PICKUP_SHIPPING", 3000)], [payment("DEPOSIT", "RECEIVED", 4000)]))).toEqual({ type: "none" });
  });

  it("follows a cancelled pair while PENDING, and is dropped when nothing is left or the Order is cancelled", () => {
    const deposit = payment("DEPOSIT", "RECEIVED", 4000);
    const balance = payment("BALANCE", "PENDING", 9000, "pay_balance");
    expect(planBalance(order([pair("READY_FOR_PICKUP_SHIPPING", 9000), pair("CANCELLED", 5000)], [deposit, balance]))).toEqual({ type: "update", paymentId: "pay_balance", amount: cents(5000) });
    expect(planBalance(order([pair("READY_FOR_PICKUP_SHIPPING", 4000)], [deposit, balance]))).toMatchObject({ type: "cancel", paymentId: "pay_balance" });
    expect(planBalance(order([pair("CANCELLED", 9000)], [deposit, balance]))).toMatchObject({ type: "cancel", paymentId: "pay_balance" });
    expect(planBalance(order([pair("READY_FOR_PICKUP_SHIPPING", 9000)], [deposit, balance]))).toEqual({ type: "update", paymentId: "pay_balance", amount: cents(5000) });
  });

  it("leaves a received or dropped Balance alone, and never makes a second one", () => {
    const deposit = payment("DEPOSIT", "RECEIVED", 4000);
    for (const status of ["RECEIVED", "FAILED", "REFUNDED"] as const) {
      expect(planBalance(order([pair("READY_FOR_PICKUP_SHIPPING", 9000), pair("CANCELLED", 5000)], [deposit, payment("BALANCE", status, 5000)]))).toEqual({ type: "none" });
    }
  });
});

describe("planVisitMoves", () => {
  const item = (id: string, status: ItemStatus) => ({ id, status, price: cents(5000) });
  const received = pay("DEPOSIT", "RECEIVED");
  const visitOrder = (payments: ReturnType<typeof pay>[], items: ReturnType<typeof item>[]) => ({ rush: false, payments, items });

  it("a Collection moves Awaiting Sneakers pairs, and names those that haven't got there", () => {
    const plan = planVisitMoves("COLLECTION", visitOrder([received], [item("a", "AWAITING_SNEAKERS"), item("b", "UNDER_REVIEW"), item("c", "APPROVED"), item("d", "IN_PROGRESS"), item("e", "CANCELLED")]));
    expect(plan.moves).toEqual([{ itemId: "a", from: "AWAITING_SNEAKERS", to: "IN_PROGRESS" }]);
    expect(plan.stays).toEqual([
      { itemId: "b", status: "UNDER_REVIEW", reason: "Not approved yet." },
      { itemId: "c", status: "APPROVED", reason: "Not moved to Awaiting Sneakers yet." },
    ]);
  });

  it("an approved pair whose Deposit is still pending stays, with the Deposit as the reason", () => {
    const plan = planVisitMoves("COLLECTION", visitOrder([pay("DEPOSIT", "PENDING")], [item("c", "APPROVED")]));
    expect(plan.moves).toEqual([]);
    expect(plan.stays[0]!.reason).toMatch(/deposit/);
  });

  it("a Return moves Ready pairs to Completed once the Balance is received, and holds them while it is pending", () => {
    const ready = item("a", "READY_FOR_PICKUP_SHIPPING");
    expect(planVisitMoves("RETURN", visitOrder([received, pay("BALANCE", "PENDING", 4000)], [ready])).stays[0]!.reason).toMatch(/^Balance not collected yet/);
    expect(planVisitMoves("RETURN", visitOrder([received, pay("BALANCE", "RECEIVED", 4000)], [ready, item("b", "QUALITY_CHECK")]))).toEqual({
      moves: [{ itemId: "a", from: "READY_FOR_PICKUP_SHIPPING", to: "COMPLETED" }],
      stays: [{ itemId: "b", status: "QUALITY_CHECK", reason: "Not ready to go back yet." }],
    });
  });

  it("a Return holds a pair readied early while another pair isn't ready", () => {
    const result = planVisitMoves("RETURN", visitOrder([received], [item("a", "READY_FOR_PICKUP_SHIPPING"), item("b", "IN_PROGRESS")]));
    expect(result.moves).toEqual([]);
    expect(result.stays[0]).toMatchObject({ itemId: "a", reason: "Collected once every pair is ready; the Balance is due then." });
  });
});
