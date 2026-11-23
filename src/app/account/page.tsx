import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import "@/styles/landing-theme.css";
import "@/features/account/my-bookings.css";
import { customerFromCookies } from "@/features/accounts/acting-user";
import { AccountSignIn } from "@/features/account/account-sign-in";
import { SiteNav } from "@/features/landing/site-nav";
import { SiteFooter } from "@/features/landing/site-footer";
import { MobileTabBar } from "@/features/landing/mobile-tabbar";
import { buildOrderUseCaseDeps } from "@/features/orders/deps";
import { listMyOrders, type MyOrder } from "@/features/orders/use-cases/list-my-orders";
import { isCustomerSignInEnabled } from "@/shared/config/feature-flags";
import { redactForLog } from "@/shared/logging/redact";

export const metadata = {
  title: "My bookings — Atunṣe",
  robots: { index: false },
};

// Per-customer data: never cached.
export const dynamic = "force-dynamic";

/** Photo links need the private bucket; without it the page still lists the bookings. */
function photoStorage(deps: ReturnType<typeof buildOrderUseCaseDeps>) {
  try {
    return deps.storage;
  } catch (err) {
    console.error(`[account] photos unavailable: ${redactForLog(err instanceof Error ? err.message : String(err))}`);
    return undefined;
  }
}

export default async function AccountPage() {
  if (!isCustomerSignInEnabled()) notFound();

  const actingUser = await customerFromCookies(await cookies());
  const signedIn = actingUser.role === "CUSTOMER";
  let orders: MyOrder[] = [];
  if (signedIn) {
    const deps = buildOrderUseCaseDeps();
    orders = await listMyOrders({ orders: deps.orders, catalog: deps.catalog, storage: photoStorage(deps) }, actingUser);
  }
  const contactEmail = process.env.CONTACT_EMAIL?.trim() || null;

  return (
    <div className="landing" id="landing-root">
      <SiteNav />
      <main id="main-content" tabIndex={-1} className="acct-page">
        <p className="landing-eyebrow">MY BOOKINGS</p>
        <h1>Your bookings</h1>
        {!signedIn ? (
          <>
            <p className="acct-lede">Sign in to see your bookings.</p>
            <AccountSignIn />
          </>
        ) : orders.length === 0 ? (
          <div className="acct-empty">
            <p>You don&rsquo;t have any bookings yet.</p>
            <Link href="/booking" className="landing-btn-primary">
              Book a restoration
            </Link>
          </div>
        ) : (
          <>
            <ul className="acct-list">
              {orders.map((order) => (
                <li key={order.id} className="acct-card">
                  <div className="acct-card-head">
                    <h2>{order.number}</h2>
                    <p className="acct-meta">Booked {order.bookedOn}</p>
                  </div>
                  <p className="acct-meta">
                    {order.fulfillment}
                    {order.when ? ` · ${order.when}` : ""}
                    {order.bundle ? ` · ${order.bundle}` : ""}
                  </p>
                  <ul className="acct-pairs">
                    {order.pairs.map((pair, index) => (
                      <li key={index} className="acct-pair">
                        <span className="acct-pair-title">{pair.title}</span>
                        <span className="acct-meta">
                          {[pair.colorway, pair.size ? `Size ${pair.size}` : null, pair.services.join(", ")].filter(Boolean).join(" · ")}
                        </span>
                        <span className="acct-status">{pair.status}</span>
                        {pair.quote && <span className="acct-meta">Quote: {pair.quote}</span>}
                        {pair.photoUrls.length > 0 && (
                          <div className="acct-photos">
                            {pair.photoUrls.map((url) => (
                              // eslint-disable-next-line @next/next/no-img-element -- short-lived signed storage URL, not optimizable
                              <img key={url} src={url} alt={`Photo of ${pair.title}`} width={64} height={64} loading="lazy" />
                            ))}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                  <div className="acct-totals">
                    <span>
                      Estimate: {order.estimateIsMinimum ? "from " : ""}
                      {order.estimate}
                    </span>
                    {order.deposit && (
                      <span>
                        Deposit {order.deposit.amount}: {order.deposit.state}
                      </span>
                    )}
                    {order.balance && (
                      <span>
                        Balance {order.balance.amount}: {order.balance.state}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <p className="acct-help">
              Need to change or cancel?{" "}
              {contactEmail ? (
                <>
                  Email us at <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
                </>
              ) : (
                <>
                  Use our <Link href="/contact">contact form</Link>
                </>
              )}
              .
            </p>
          </>
        )}
      </main>
      <SiteFooter />
      <MobileTabBar />
    </div>
  );
}
