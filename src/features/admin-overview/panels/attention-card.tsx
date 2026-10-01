import { cookies } from "next/headers";
import { actingUserFromCookies } from "@/features/accounts/acting-user";
import { buildMessageDeps } from "@/features/messages/deps";
import { countUnreadMessages } from "@/features/messages/use-cases/get-unread-messages";
import { ChatCenteredTextIcon, ClipboardTextIcon, CreditCardIcon, PackageIcon, WarningIcon } from "@phosphor-icons/react/dist/ssr";
import { AttentionItem } from "../attention-item";
import type { AdminOverview } from "../get-admin-overview";
import { overviewHref, type OverviewSelection } from "../overview-range";
import { SAMPLE_LOW_STOCK_ITEMS } from "../sample-data";
import { SampleTag } from "./sample-tag";

export async function AttentionCard({ overview, selection }: { overview: AdminOverview; selection: OverviewSelection }) {
  // Needs the acting user (admin-checked by the use-case), which the panels grid doesn't pass down.
  const unreadMessages = await countUnreadMessages(buildMessageDeps(), await actingUserFromCookies(await cookies()));
  return (
    <section className="ov-card" aria-labelledby="ov-attention-title">
      <h2 id="ov-attention-title" className="ov-card-title">
        Needs Attention
      </h2>
      <ul className="ov-attention">
        <AttentionItem tone="red" icon={CreditCardIcon} title="Pending Payments" detail="Awaiting customer deposit" count={overview.awaitingDeposit.orders} href={overviewHref(selection, { attention: "pending-payments" })} />
        <AttentionItem tone="orange" icon={PackageIcon} title="Ready to Return" detail="Completed and ready to go back" count={overview.readyForReturn} href={overviewHref(selection, { attention: "ready-to-return" })} />
        <AttentionItem tone="blue" icon={ClipboardTextIcon} title="Needs a Quote" detail="Pairs waiting on your review" count={overview.needsQuote} href={overviewHref(selection, { attention: "needs-quote" })} />
        <AttentionItem tone="violet" icon={ChatCenteredTextIcon} title="Unread Messages" detail="Customer inquiries" count={unreadMessages} href={overviewHref(selection, { attention: "messages" })} />
        <AttentionItem tone="gray" icon={WarningIcon} title="Low Stock Items" detail="Restock soon" count={SAMPLE_LOW_STOCK_ITEMS} sampleTag={<SampleTag />} />
      </ul>
    </section>
  );
}
