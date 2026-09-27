import type { ActingUser } from "@/features/accounts/authz";
import { requireRole } from "@/features/accounts/authz";
import type { FileStorage } from "@/shared/storage";
import type { OrderRepository } from "../repositories/order-repository";

export class OrderNotFoundError extends Error {
  constructor() {
    super("Order not found.");
    this.name = "OrderNotFoundError";
  }
}

export interface OrderPhotos {
  orderId: string;
  items: { itemId: string; photos: { key: string; url: string }[] }[];
}

/**
 * Short-lived view links for an Order's photos (ADR-0014). The bucket is
 * private, so these links are the only way to see a photo: an Admin gets
 * any Order's, a Customer only their own Account's, and everyone else
 * nothing. Someone else's Order answers "not found", never "forbidden",
 * so order ids can't be probed.
 */
export async function getOrderPhotos(
  deps: { orders: OrderRepository; storage: FileStorage; customerSignInEnabled: boolean },
  actingUser: ActingUser,
  orderId: string,
): Promise<OrderPhotos> {
  requireRole(actingUser, "CUSTOMER", "ADMIN");

  const order = await deps.orders.findById(orderId);
  const isOwner = actingUser.role === "CUSTOMER" && deps.customerSignInEnabled && order?.accountId === actingUser.accountId;
  if (!order || (actingUser.role !== "ADMIN" && !isOwner)) throw new OrderNotFoundError();

  return {
    orderId: order.id,
    items: await Promise.all(
      order.items.map(async (item) => ({
        itemId: item.id,
        photos: await Promise.all(
          item.photoKeys.map(async (key) => ({ key, url: await deps.storage.createViewUrl(key) })),
        ),
      })),
    ),
  };
}
