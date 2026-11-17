import { describe, expect, it } from "vitest";
import { UnauthorizedError } from "@/features/accounts/authz";
import { InMemoryFileStorage } from "@/shared/storage/in-memory-file-storage";
import { listMyOrders } from "./list-my-orders";
import { submitOrder } from "./submit-order";
import { bookingDeps, validBookingInput, validPair } from "./test-fixtures";

const GUEST = { accountId: null, role: "GUEST" } as const;

async function seed() {
  const deps = bookingDeps();
  const first = await submitOrder(deps, GUEST, validBookingInput());
  const second = await submitOrder(
    deps,
    GUEST,
    validBookingInput({ contact: { ...validBookingInput().contact, email: "other@example.com" }, items: [validPair({ brand: "Adidas Samba" }, 1)] }),
  );
  return { deps, first, second };
}

describe("listMyOrders", () => {
  it("returns only the signed-in customer's orders, in customer words", async () => {
    const { deps, first, second } = await seed();
    const mine = await listMyOrders(deps, { accountId: first.accountId, role: "CUSTOMER" });
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({
      id: first.id,
      number: `ATU-${first.number}`,
      fulfillment: "Local Drop-Off",
      when: "Saturday, October 3, 2026, 4:30 PM – 5:00 PM",
      bundle: null,
      pairs: [{ title: "Nike Air Force 1", services: ["Standard Clean"], status: "Request Submitted", quote: null }],
    });
    expect(JSON.stringify(mine)).not.toMatch(/pickup/i);
    const theirs = await listMyOrders(deps, { accountId: second.accountId, role: "CUSTOMER" });
    expect(theirs.map((o) => o.id)).toEqual([second.id]);
  });

  it("lists newest first", async () => {
    const { deps, first } = await seed();
    const again = await submitOrder(deps, { accountId: first.accountId, role: "CUSTOMER" }, validBookingInput({ submissionKey: "k2", items: [validPair({}, 2)] }));
    (await deps.orders.findById(again.id))!.createdAt = new Date("2030-01-01T00:00:00Z");
    const mine = await listMyOrders(deps, { accountId: first.accountId, role: "CUSTOMER" });
    expect(mine.map((o) => o.id)).toEqual([again.id, first.id]);
  });

  it("shows a quote only once it is sent", async () => {
    const { deps, first } = await seed();
    const order = (await deps.orders.findById(first.id))!;
    order.items[0]!.price = (await import("@/shared/money/money")).Money.fromCents(9000);
    order.items[0]!.serviceIds = ["reglue"];
    order.items[0]!.status = "UNDER_REVIEW";
    expect((await listMyOrders(deps, { accountId: first.accountId, role: "CUSTOMER" }))[0]!.pairs[0]!.quote).toBeNull();
    order.items[0]!.status = "QUOTE_SENT";
    const [mine] = await listMyOrders(deps, { accountId: first.accountId, role: "CUSTOMER" });
    expect(mine!.pairs[0]).toMatchObject({ status: "Quote Sent", quote: "$90" });
  });

  it("includes photo links only when storage is given", async () => {
    const { deps, first } = await seed();
    const me = { accountId: first.accountId, role: "CUSTOMER" } as const;
    const { orders, catalog } = deps;
    expect((await listMyOrders({ orders, catalog }, me))[0]!.pairs[0]!.photoUrls).toEqual([]);
    const [withPhotos] = await listMyOrders({ orders, catalog, storage: new InMemoryFileStorage() }, me);
    expect(withPhotos!.pairs[0]!.photoUrls).toHaveLength(1);
  });

  it("refuses anonymous callers and admins", async () => {
    const { deps } = await seed();
    await expect(listMyOrders(deps, GUEST)).rejects.toThrow(UnauthorizedError);
    await expect(listMyOrders(deps, { accountId: "acc_admin", role: "ADMIN" })).rejects.toThrow(UnauthorizedError);
  });
});
