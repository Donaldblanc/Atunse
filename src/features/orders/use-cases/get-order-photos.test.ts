import { describe, expect, it } from "vitest";
import { UnauthorizedError } from "@/features/accounts/authz";
import { InMemoryFileStorage } from "@/shared/storage/in-memory-file-storage";
import { getOrderPhotos, OrderNotFoundError } from "./get-order-photos";
import { submitOrder } from "./submit-order";
import { bookingDeps, validBookingInput } from "./test-fixtures";

const storage = new InMemoryFileStorage();

async function seed(customerSignInEnabled = true) {
  const deps = bookingDeps({ customerSignInEnabled });
  const order = await submitOrder(deps, { accountId: null, role: "GUEST" }, validBookingInput());
  return { photoDeps: { orders: deps.orders, storage, customerSignInEnabled }, order };
}

describe("getOrderPhotos", () => {
  it("gives the owning customer signed view links for their photos", async () => {
    const { photoDeps, order } = await seed();
    const result = await getOrderPhotos(photoDeps, { accountId: order.accountId, role: "CUSTOMER" }, order.id);
    expect(result.items[0]?.photos).toEqual([
      { key: order.items[0]!.photoKeys[0], url: `https://storage.test/signed/${order.items[0]!.photoKeys[0]}` },
    ]);
  });

  it("lets an admin view any order's photos", async () => {
    const { photoDeps, order } = await seed();
    const result = await getOrderPhotos(photoDeps, { accountId: "acc_admin", role: "ADMIN" }, order.id);
    expect(result.items[0]?.photos).toHaveLength(1);
  });

  it("answers 'not found' to another customer, and for unknown orders", async () => {
    const { photoDeps, order } = await seed();
    await expect(
      getOrderPhotos(photoDeps, { accountId: "acc_someone_else", role: "CUSTOMER" }, order.id),
    ).rejects.toThrow(OrderNotFoundError);
    await expect(
      getOrderPhotos(photoDeps, { accountId: order.accountId, role: "CUSTOMER" }, "order_missing"),
    ).rejects.toThrow(OrderNotFoundError);
  });

  it("refuses signed-out callers", async () => {
    const { photoDeps, order } = await seed();
    await expect(getOrderPhotos(photoDeps, { accountId: null, role: "GUEST" }, order.id)).rejects.toThrow(
      UnauthorizedError,
    );
  });

  it("shows customers nothing while customer login is toggled off", async () => {
    const { photoDeps, order } = await seed(false);
    await expect(
      getOrderPhotos(photoDeps, { accountId: order.accountId, role: "CUSTOMER" }, order.id),
    ).rejects.toThrow(OrderNotFoundError);
  });
});
