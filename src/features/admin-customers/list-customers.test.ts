import { describe, expect, it } from "vitest";
import { UnauthorizedError, type ActingUser } from "@/features/accounts/authz";
import { InMemoryAccounts } from "@/features/accounts/repositories/in-memory-repositories";
import { InMemoryOrderRepository } from "@/features/orders/repositories/in-memory-order-repository";
import type { NewOrderInput } from "@/features/orders/repositories/order-repository";
import { Money } from "@/shared/money/money";
import { listCustomers } from "./list-customers";

const ADMIN: ActingUser = { accountId: "acc_admin", role: "ADMIN" };
const CUSTOMER: ActingUser = { accountId: "acc_cust", role: "CUSTOMER" };

let photoCounter = 0;

function newOrderInput(email: string, overrides: Partial<NewOrderInput> = {}): NewOrderInput {
  photoCounter += 1;
  return {
    owner: { newCustomer: { email, phone: "2125550142" } },
    contactName: "Jordan Smith",
    contactEmail: email,
    contactPhone: "2125550142",
    policyAcceptedAt: new Date("2026-09-29T14:00:00Z"),
    terms: { version: "v1", url: "/terms.pdf", sha256: "x", acknowledgments: {} },
    fulfillment: { method: "MAIL_IN", address: { line1: "1 Main St", line2: null, city: "Austin", state: "TX", zip: "73301" }, preferredDate: null },
    rush: false,
    estimate: Money.fromCents(3000),
    estimateIsMinimum: false,
    deposit: Money.fromCents(1500),
    depositPayment: { method: "ZELLE", amount: Money.fromCents(1500) },
    collection: null,
    submissionKey: null,
    submissionFingerprint: null,
    bundleId: null,
    alertBody: "Jordan · Standard Clean · Mail-In",
    items: [
      {
        brand: null,
        model: null,
        description: null,
        material: null,
        serviceIds: ["standard"],
        estimate: Money.fromCents(3000),
        photos: [{ key: `photos/${photoCounter}.jpg`, uploadKey: `bookings/${photoCounter}.jpg` }],
      },
    ],
    ...overrides,
  };
}

describe("listCustomers", () => {
  it("rejects a non-admin", async () => {
    const orders = new InMemoryOrderRepository();
    await expect(listCustomers({ accounts: orders.accounts, orders }, CUSTOMER)).rejects.toThrow(UnauthorizedError);
  });

  it("lists Customer Accounts, newest first, with each one's Order count", async () => {
    const orders = new InMemoryOrderRepository();
    const { order: first } = await orders.create(newOrderInput("a@example.com"));
    await orders.create(newOrderInput("b@example.com"));
    await orders.create(newOrderInput("a@example.com", { owner: { accountId: first.accountId } }));

    const rows = await listCustomers({ accounts: orders.accounts, orders }, ADMIN);

    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.email)).toEqual(["b@example.com", "a@example.com"]);
    const a = rows.find((r) => r.email === "a@example.com");
    const b = rows.find((r) => r.email === "b@example.com");
    expect(a?.orderCount).toBe(2);
    expect(b?.orderCount).toBe(1);
  });

  it("never returns an Admin Account", async () => {
    const accounts = new InMemoryAccounts();
    accounts.add({ role: "ADMIN", email: "owner@example.com" });
    const orders = new InMemoryOrderRepository(accounts);

    const rows = await listCustomers({ accounts, orders }, ADMIN);

    expect(rows).toHaveLength(0);
  });
});
