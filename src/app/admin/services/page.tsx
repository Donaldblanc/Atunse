// The admin Services & Pricing screen (ADR-0016): All Services, Bundles and
// Additional Services tabs over the Service/Bundle tables. Categories isn't
// built yet (not detailed in the design beyond its tab label) — it renders
// as "Soon", same convention as the sidebar's unbuilt screens.
//
// Booking still prices from src/features/orders/service-catalog.ts, not
// these tables (TODO #257): editing a price here doesn't yet change what
// customers see in /booking. The page says so in a notice banner.

import Link from "next/link";
import { cookies } from "next/headers";
import { actingUserFromCookies } from "@/features/accounts/acting-user";
import { AdminDialog } from "@/shared/ui/admin-dialog";
import { Money } from "@/shared/money/money";
import { findBundle } from "@/features/orders/service-catalog";
import { AddBundleForm } from "@/features/services/add-bundle-form";
import { CATEGORY_LABELS } from "@/features/services/catalog-labels";
import { EditBundleForm } from "@/features/services/edit-bundle-form";
import { EditServiceForm } from "@/features/services/edit-service-form";
import { buildCatalogDeps } from "@/features/services/deps";
import type { BundleRecord, ServiceCategory, ServiceRecord } from "@/features/services/repositories/catalog-repository";
import { listCatalog } from "@/features/services/use-cases/list-catalog";
import { SERVICE_CATEGORIES } from "@/features/services/use-cases/update-catalog-item";
import "@/features/services/services.css";

export const metadata = { title: "Services & Pricing · Atunṣe Admin" };

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;
type Tab = "all" | "bundles" | "additional" | "categories";

function tabFrom(value: string | string[] | undefined): Tab {
  return value === "bundles" || value === "additional" || value === "categories" ? value : "all";
}

function hrefFor(params: { tab?: Tab; q?: string; category?: string; status?: string }): string {
  const search = new URLSearchParams();
  if (params.tab && params.tab !== "all") search.set("tab", params.tab);
  if (params.q) search.set("q", params.q);
  if (params.category) search.set("category", params.category);
  if (params.status) search.set("status", params.status);
  const query = search.toString();
  return query ? `/admin/services?${query}` : "/admin/services";
}

function matchesFilters(service: ServiceRecord, q: string, category: string, status: string): boolean {
  if (q && !service.name.toLowerCase().includes(q.toLowerCase()) && !service.description.toLowerCase().includes(q.toLowerCase())) return false;
  if (category && service.category !== category) return false;
  if (status === "active" && !service.active) return false;
  if (status === "inactive" && service.active) return false;
  return true;
}

function servicePrice(service: ServiceRecord): string {
  const base = Money.fromCents(service.baseCents).format();
  const price = service.isMinimum ? `From ${base}` : base;
  return service.suedeFeeCents > 0 ? `${price} +${Money.fromCents(service.suedeFeeCents).format()} (Suede)` : price;
}

export default async function AdminServicesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const actingUser = await actingUserFromCookies(await cookies());
  const { services, bundles } = await listCatalog(buildCatalogDeps(), actingUser);

  const tab = tabFrom(params.tab);
  const q = typeof params.q === "string" ? params.q : "";
  const category = typeof params.category === "string" ? params.category : "";
  const status = typeof params.status === "string" ? params.status : "";

  const effectiveCategory = tab === "additional" ? ("ADDITIONAL" satisfies ServiceCategory) : category;
  const filteredServices = services.filter((service) => matchesFilters(service, q, effectiveCategory, status));

  const editServiceId = typeof params.edit === "string" ? params.edit : null;
  const editBundleId = typeof params.bundle === "string" ? params.bundle : null;
  const addingBundle = params.addBundle === "1";
  const editingService = editServiceId ? services.find((s) => s.id === editServiceId) : null;
  const editingBundle = editBundleId ? bundles.find((b) => b.id === editBundleId) : null;
  const closeHref = hrefFor({ tab, q, category, status });

  return (
    <div className="ov">
      <div className="ov-header">
        <div>
          <p className="ov-eyebrow">Services &amp; Pricing</p>
          <h1 className="ov-title">Manage your services, pricing, and bundles.</h1>
        </div>
      </div>

      <p className="sv-notice" role="note">
        Prices and availability here don&apos;t change the booking page yet. Booking still uses the built-in price list.
      </p>

      <nav className="sv-tabs" aria-label="Services & Pricing tabs">
        <Link className="sv-tab" href={hrefFor({ tab: "all" })} aria-current={tab === "all" ? "page" : undefined}>
          All Services
        </Link>
        <Link className="sv-tab" href={hrefFor({ tab: "bundles" })} aria-current={tab === "bundles" ? "page" : undefined}>
          Bundles
        </Link>
        <Link className="sv-tab" href={hrefFor({ tab: "additional" })} aria-current={tab === "additional" ? "page" : undefined}>
          Additional Services
        </Link>
        <span className="sv-tab sv-tab-soon" aria-disabled="true" title="Coming soon">
          Categories
        </span>
      </nav>

      {tab === "categories" ? (
        <p className="ov-empty">Categories is coming soon.</p>
      ) : tab === "bundles" ? (
        <BundlesTable bundles={bundles} closeHref={closeHref} />
      ) : (
        <>
          <form action="/admin/services" method="get" role="search" className="sv-search">
            {tab === "additional" && <input type="hidden" name="tab" value="additional" />}
            <label htmlFor="sv-q" className="sr-only">
              Search services
            </label>
            <input id="sv-q" name="q" type="search" className="att-search-input" maxLength={100} defaultValue={q} placeholder="Search services..." />
            <select name="category" defaultValue={category} className="sv-select">
              <option value="">All categories</option>
              {SERVICE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
            <select name="status" defaultValue={status} className="sv-select">
              <option value="">All status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <button type="submit" className="admin-btn">
              Search
            </button>
            <Link href={hrefFor({ tab })} className="admin-btn" data-variant="secondary">
              Reset
            </Link>
          </form>

          <ServicesTable services={filteredServices} closeHref={closeHref} />
        </>
      )}

      {editingService && (
        <AdminDialog title="Edit Service" closeHref={closeHref} size="md">
          <EditServiceForm service={editingService} closeHref={closeHref} />
        </AdminDialog>
      )}
      {editingBundle && (
        <AdminDialog title="Edit Bundle" closeHref={closeHref} size="md">
          <EditBundleForm bundle={editingBundle} closeHref={closeHref} />
        </AdminDialog>
      )}
      {addingBundle && (
        <AdminDialog title="Add Bundle" closeHref={closeHref} size="md">
          <AddBundleForm closeHref={closeHref} />
        </AdminDialog>
      )}
    </div>
  );
}

function ServicesTable({ services, closeHref }: { services: ServiceRecord[]; closeHref: string }) {
  if (services.length === 0) return <p className="ov-empty">No services match those filters.</p>;
  return (
    <div className="ov-table-scroll">
      <table className="ov-table">
        <thead>
          <tr>
            <th scope="col">Service</th>
            <th scope="col">Description</th>
            <th scope="col">Price</th>
            <th scope="col">Category</th>
            <th scope="col">Status</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {services.map((service) => (
            <tr key={service.id}>
              <td className="ov-cell-main">{service.name}</td>
              <td className="ov-cell-sub">{service.description}</td>
              <td>{servicePrice(service)}</td>
              <td>
                <span className="sv-pill">{CATEGORY_LABELS[service.category]}</span>
              </td>
              <td>
                <span className={service.active ? "sv-pill sv-pill-active" : "sv-pill sv-pill-inactive"}>{service.active ? "Active" : "Inactive"}</span>
              </td>
              <td>
                <Link href={`${closeHref}${closeHref.includes("?") ? "&" : "?"}edit=${service.id}`} className="admin-btn" data-variant="secondary">
                  Edit
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const PROMO_DATE_FORMAT = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric" });

/** "Promotion · ends Dec 21, 2026" when the built-in catalog has an end date for this bundle id; null otherwise. */
function promotionLabel(bundleId: string): string | null {
  const endsAt = findBundle(bundleId)?.endsAt;
  if (!endsAt) return null;
  // endsAt is the instant after the last promo day; show the last day in New York time.
  return `Promotion · ends ${PROMO_DATE_FORMAT.format(new Date(Date.parse(endsAt) - 1))}`;
}

function BundlesTable({ bundles, closeHref }: { bundles: BundleRecord[]; closeHref: string }) {
  return (
    <div className="ov-card">
      <div className="ov-card-head">
        <h2 className="ov-card-title">Bundle Services</h2>
        <Link href={`${closeHref}${closeHref.includes("?") ? "&" : "?"}addBundle=1`} className="admin-btn">
          + Add Bundle
        </Link>
      </div>
      {bundles.length === 0 ? (
        <p className="ov-empty">No bundles yet.</p>
      ) : (
        <div className="ov-table-scroll">
          <table className="ov-table">
            <thead>
              <tr>
                <th scope="col">Service</th>
                <th scope="col">Description</th>
                <th scope="col">Price</th>
                <th scope="col">Status</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {bundles.map((bundle) => (
                <tr key={bundle.id}>
                  <td className="ov-cell-main">
                    {bundle.name}
                    {promotionLabel(bundle.id) && (
                      <>
                        {" "}
                        <span className="sv-pill">{promotionLabel(bundle.id)}</span>
                      </>
                    )}
                  </td>
                  <td className="ov-cell-sub">{bundle.perks.join(", ")}</td>
                  <td>{Money.fromCents(bundle.priceCents).format()}</td>
                  <td>
                    <span className={bundle.active ? "sv-pill sv-pill-active" : "sv-pill sv-pill-inactive"}>{bundle.active ? "Active" : "Inactive"}</span>
                  </td>
                  <td>
                    <Link href={`${closeHref}${closeHref.includes("?") ? "&" : "?"}bundle=${bundle.id}`} className="admin-btn" data-variant="secondary">
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
