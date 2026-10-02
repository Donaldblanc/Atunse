import { ChatCenteredTextIcon, ClipboardTextIcon, CreditCardIcon, PackageIcon, WarningIcon } from "@phosphor-icons/react/dist/ssr";
import { AttentionItem } from "../attention-item";
import type { AdminOverview } from "../get-admin-overview";
import { overviewHref, type OverviewSelection } from "../overview-range";
import { SAMPLE_LOW_STOCK_ITEMS, SAMPLE_UNREAD_MESSAGES } from "../sample-data";
import { SampleTag } from "./sample-tag";

export function AttentionCard({ overview, selection }: { overview: AdminOverview; selection: OverviewSelection }) {
  return (
    <section className="ov-card" aria-labelledby="ov-attention-title">
      <h2 id="ov-attention-title" className="ov-card-title">
        Needs Attention
      </h2>
      <ul className="ov-attention">
        <AttentionItem tone="red" icon={CreditCardIcon} title="Pending Payments" detail="Awaiting customer payment" count={overview.awaitingPayments.payments} href={overviewHref(selection, { attention: "pending-payments" })} />
        <AttentionItem tone="orange" icon={PackageIcon} title="Ready to Return" detail="Completed and ready to go back" count={overview.readyForReturn} href={overviewHref(selection, { attention: "ready-to-return" })} />
        <AttentionItem tone="blue" icon={ClipboardTextIcon} title="Needs a Quote" detail="Pairs waiting on your review" count={overview.needsQuote} href={overviewHref(selection, { attention: "needs-quote" })} />
        <AttentionItem tone="violet" icon={ChatCenteredTextIcon} title="Unread Messages" detail="Customer inquiries" count={SAMPLE_UNREAD_MESSAGES} sampleTag={<SampleTag />} />
        <AttentionItem tone="gray" icon={WarningIcon} title="Low Stock Items" detail="Restock soon" count={SAMPLE_LOW_STOCK_ITEMS} sampleTag={<SampleTag />} />
      </ul>
    </section>
  );
}
