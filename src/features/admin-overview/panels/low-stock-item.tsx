import { WarningIcon } from "@phosphor-icons/react/dist/ssr";
import { cookies } from "next/headers";
import { actingUserFromCookies } from "@/features/accounts/acting-user";
import { buildInventoryDeps } from "@/features/inventory/deps";
import { getLowStockCount } from "@/features/inventory/use-cases/get-low-stock";
import { AttentionItem } from "../attention-item";
import { overviewHref, type OverviewSelection } from "../overview-range";

/** Needs Attention's Low Stock row: the real count, loaded here (its own data path, not getAdminOverview). */
export async function LowStockItem({ selection }: { selection: OverviewSelection }) {
  const count = await getLowStockCount(buildInventoryDeps(), await actingUserFromCookies(await cookies()));
  return <AttentionItem tone="gray" icon={WarningIcon} title="Low Stock Items" detail="Restock soon" count={count} href={overviewHref(selection, { attention: "low-stock" })} />;
}
