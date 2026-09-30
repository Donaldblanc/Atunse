import { describe, expect, it } from "vitest";
import { Money } from "@/shared/money/money";
import type { Order } from "./domain";
import { InMemoryOrderRepository } from "./repositories/in-memory-order-repository";
import { cancelledEmail, quotedTotal, quoteSentEmail, readyEmail, statusChangeEmail } from "./status-emails";
import { submitOrder } from "./use-cases/submit-order";
import { bookingDeps, validBookingInput, validBundleInput } from "./use-cases/test-fixtures";

async function book(overrides: Parameters<typeof validBookingInput>[0] = {}): Promise<Order> {
  return submitOrder(bookingDeps({ orders: new InMemoryOrderRepository() }), { accountId: null, role: "GUEST" }, validBookingInput(overrides));
}

const cents = (value: number) => Money.fromCents(value);
// Only a Bundle books several pairs (three); cancelling the third leaves two live.
const twoPairs = async () => {
  const order = await book(validBundleInput());
  order.items[0]!.brand = "Nike Air Force 1";
  order.items[1]!.brand = "Adidas Samba";
  order.items[2]!.status = "CANCELLED";
  return order;
};

describe("quoteSentEmail", () => {
  it("states the price, the estimate difference, the pending Deposit and the balance, for a single pair", async () => {
    const order = await book();
    const item = order.items[0]!;
    item.price = cents(item.estimate.cents + 1500);

    const { subject, body } = quoteSentEmail(order, item);

    expect(subject).toBe(`Your quote for ATU-${order.number}`);
    expect(body).toContain(`your quote for booking ATU-${order.number} is ready: ${item.price.format()}`);
    expect(body).toContain(`$15 more than the ${item.estimate.format()} estimate`);
    expect(body).toContain(`deposit is still to be paid`);
    expect(body).toContain(`remaining balance of ${item.price.subtract(order.deposit).format()}`);
    expect(body).toContain("We won't start until you say yes");
  });

  it("says a paid Deposit won't be charged again, and names no balance when nothing is left", async () => {
    const order = await book();
    const item = order.items[0]!;
    item.price = cents(order.deposit.cents); // quote no higher than the Deposit
    order.payments[0]!.status = "RECEIVED";

    const { body } = quoteSentEmail(order, item);

    expect(body).toContain("already paid, and it won't be charged again");
    expect(body).not.toContain("remaining balance");
  });

  it("says nothing about a difference when the quote matches the estimate", async () => {
    const order = await book();
    const item = order.items[0]!;
    item.price = item.estimate;
    expect(quoteSentEmail(order, item).body).not.toContain("estimate from when you booked");
  });

  it("names the pair and what's quoted so far while a multi-pair Order is only partly quoted", async () => {
    const order = await twoPairs();
    const [first] = order.items;
    first!.price = cents(6000);

    const { body } = quoteSentEmail(order, first!);

    expect(body).toContain("Pair 1 (Nike Air Force 1)");
    expect(body).toContain("Quoted so far on");
    expect(body).toContain("$60 across 1 of 2 pairs"); // the cancelled third doesn't count
    expect(body).not.toContain("remaining balance"); // not known until every pair is quoted
  });

  it("gives the Order's total once every live pair is quoted, ignoring a cancelled one", async () => {
    const order = await book(validBundleInput());
    order.items[0]!.price = cents(6000);
    order.items[1]!.price = cents(7000);
    order.items[2]!.status = "CANCELLED";

    expect(quotedTotal(order)?.format()).toBe("$130");
    expect(quoteSentEmail(order, order.items[1]!).body).toContain("for a total of $130");
  });

  it("adds the Rush fee to the total", async () => {
    const order = await book({ rush: true });
    order.items[0]!.price = cents(6000);
    expect(quotedTotal(order)?.format()).toBe("$80");
    expect(quoteSentEmail(order, order.items[0]!).body).toContain("your total is $80");
  });

  it("refuses a pair with no price", async () => {
    const order = await book();
    expect(() => quoteSentEmail(order, order.items[0]!)).toThrow();
  });
});

describe("readyEmail", () => {
  it("tells a Local Drop-Off customer DJ will bring it back", async () => {
    const order = await book();
    const { subject, body } = readyEmail(order, order.items[0]!);
    expect(subject).toBe(`Your sneakers are ready (ATU-${order.number})`);
    expect(body).toContain("Local Drop-Off: DJ will bring them back to 123 Main St, New York, NY 10001");
    expect(body).not.toMatch(/pickup/i);
  });

  it("tells a Mail-In customer it's ready to ship back", async () => {
    const order = await book({
      fulfillment: { method: "MAIL_IN", address: { line1: "9 Oak Ave", line2: null, city: "Austin", state: "TX", zip: "73301" }, preferredDate: null },
    });
    const { body } = readyEmail(order, order.items[0]!);
    expect(body).toContain("Mail-In: they're ready to ship back to 9 Oak Ave, Austin, TX 73301");
    expect(body).not.toMatch(/pickup|DJ will bring/i);
  });

  it("speaks of one pair in a multi-pair Order, and includes the balance once fully quoted", async () => {
    const order = await twoPairs();
    order.items[0]!.price = cents(9000);
    order.items[1]!.price = cents(9000);
    const { body } = readyEmail(order, order.items[1]!);
    expect(body).toContain("Pair 2 (Adidas Samba)");
    expect(body).toContain("DJ will bring it back");
    expect(body).toContain(`remaining balance of ${cents(18000).subtract(order.deposit).format()}`);
  });
});

describe("cancelledEmail", () => {
  it("cancels one pair and says the rest carries on", async () => {
    const order = await twoPairs();
    order.items[0]!.status = "CANCELLED";
    const { subject, body } = cancelledEmail(order, order.items[0]!);
    expect(subject).toBe(`A pair on ATU-${order.number} was cancelled`);
    expect(body).toContain("Pair 1 (Nike Air Force 1)");
    expect(body).toContain("rest of your booking carries on");
  });

  it("cancels the whole Order when every pair is cancelled, and mentions a paid Deposit", async () => {
    const order = await twoPairs();
    for (const item of order.items) item.status = "CANCELLED";
    order.payments[0]!.status = "RECEIVED";
    const { subject, body } = cancelledEmail(order, order.items[1]!);
    expect(subject).toBe(`Your booking ATU-${order.number} was cancelled`);
    expect(body).toContain("has been cancelled");
    expect(body).toContain("about your deposit");
  });
});

describe("statusChangeEmail", () => {
  it("emails only Ready for Drop-Off/Shipping and Cancelled, never with a status code", async () => {
    const order = await book();
    const item = order.items[0]!;
    const emailed: string[] = [];
    for (const status of ["REQUEST_SUBMITTED", "UNDER_REVIEW", "QUOTE_SENT", "APPROVED", "AWAITING_SNEAKERS", "IN_PROGRESS", "QUALITY_CHECK", "READY_FOR_PICKUP_SHIPPING", "COMPLETED", "CANCELLED"] as const) {
      item.status = status;
      const email = statusChangeEmail(order, item);
      if (email) {
        emailed.push(status);
        expect(`${email.subject} ${email.body}`).not.toMatch(/READY_FOR|CANCELLED|_/);
      }
    }
    expect(emailed).toEqual(["READY_FOR_PICKUP_SHIPPING", "CANCELLED"]);
  });
});
