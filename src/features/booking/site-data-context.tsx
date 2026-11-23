"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { Catalog } from "@/features/orders/service-catalog";
import type { SiteSettings } from "@/features/settings/use-cases/get-site-settings";
import { bookingAddOns, bookingBundles, bookingServices, type BookingAddOn, type BookingBundle, type BookingService } from "./services-data";

/**
 * What the booking flow reads from the database through its server page: the
 * Service/Bundle catalog and Settings' hours and Fulfillment Methods (plain,
 * serializable values), plus the lists of what a customer can pick today.
 * Display only: submitOrder prices and validates against its own copy
 * (ADR-0016).
 */
export interface SiteData {
  catalog: Catalog;
  settings: SiteSettings;
  /** Active main Services, with icons. */
  services: BookingService[];
  /** Active Add-ons, with icons. */
  addOns: BookingAddOn[];
  /** Active Bundles that haven't ended, with icons. */
  bundles: BookingBundle[];
}

const SiteDataContext = createContext<SiteData | null>(null);

export function SiteDataProvider({ catalog, settings, children }: { catalog: Catalog; settings: SiteSettings; children: ReactNode }) {
  // Fixed when the page loads: a promotion that ends mid-booking is still refused by the server.
  const [now] = useState(() => new Date());
  const value = useMemo<SiteData>(
    () => ({ catalog, settings, services: bookingServices(catalog), addOns: bookingAddOns(catalog), bundles: bookingBundles(catalog, now) }),
    [catalog, settings, now],
  );
  return <SiteDataContext.Provider value={value}>{children}</SiteDataContext.Provider>;
}

export function useSiteData(): SiteData {
  const value = useContext(SiteDataContext);
  if (!value) throw new Error("useSiteData must be used inside a SiteDataProvider.");
  return value;
}
