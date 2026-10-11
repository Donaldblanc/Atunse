import { describe, expect, it } from "vitest";
import { UnauthorizedError, type ActingUser } from "@/features/accounts/authz";
import { InMemoryOrderRepository } from "@/features/orders/repositories/in-memory-order-repository";
import type { NewOrderInput } from "@/features/orders/repositories/order-repository";
import { Money } from "@/shared/money/money";
import { getCustomerDetail } from "./customer-detail";

const ADMIN: ActingUser = { accountId: "acc_admin", role: "ADMIN" };
const CUSTOMER: ActingUser = { accountId: "acc_cust", role: "CUSTOMER" };

let photoCounter = 0;

function newOrderInput(overrides: Partial<NewOrderInput> = {}): NewOrderInput {
  photoCounter += 1;
  return {
    owner: { newCustomer: { email: "jordan@example.com", phone: "2125550142" } },
    contactName: "Jordan Smith",
    contactEmail: "jordan@example.com",
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

describe("getCustomerDetail", () => {
  it("rejects a non-admin", async () => {
    const orders = new InMemoryOrderRepository();
    await expect(getCustomerDetail({ accounts: orders.accounts, orders }, CUSTOMER, "acc_1")).rejects.toThrow(UnauthorizedError);
  });

  it("returns null for an id no Customer Account has", async () => {
    const orders = new InMemoryOrderRepository();
    expect(await getCustomerDetail({ accounts: orders.accounts, orders }, ADMIN, "nope")).toBeNull();
  });

  it("returns the Account's contact details and its Orders, newest first", async () => {
    const orders = new InMemoryOrderRepository();
    const { order: first } = await orders.create(newOrderInput());
    first.createdAt = new Date("2026-09-01T00:00:00Z");
    const { order: second } = await orders.create(newOrderInput({ owner: { accountId: first.accountId } }));
    second.createdAt = new Date("2026-09-02T00:00:00Z");

    const detail = await getCustomerDetail({ accounts: orders.accounts, orders }, ADMIN, first.accountId);

    expect(detail).toMatchObject({ email: "jordan@example.com", phone: "2125550142" });
    expect(detail?.orders.map((o) => o.orderId)).toEqual([second.id, first.id]);
  });
});
