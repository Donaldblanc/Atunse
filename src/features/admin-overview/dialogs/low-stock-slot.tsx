import { buildInventoryDeps } from "@/features/inventory/deps";
import { getLowStockItems } from "@/features/inventory/use-cases/get-low-stock";
import { LowStockDialog } from "../low-stock-dialog";
import type { OverviewDialogContext, OverviewParams } from "./overview-dialog-context";

export const matchesLowStock = (params: OverviewParams) => params.attention === "low-stock";

export async function LowStockSlot({ actingUser, closeHref }: OverviewDialogContext) {
  const items = await getLowStockItems(buildInventoryDeps(), actingUser);
  return <LowStockDialog items={items} closeHref={closeHref} />;
}
