import { describe, expect, it } from "vitest";
import { formatChartDay, ordersFilterLabel, revenueBarHref, revenueTrendTitleHref, serviceLegendHref } from "./chart-links";

describe("chart links", () => {
  it("builds the bar, legend and title hrefs, keeping the range", () => {
    expect(revenueBarHref("this-week", "2026-09-30")).toBe("/admin?orders=all&day=2026-09-30");
    expect(revenueBarHref("last-week", "2026-09-23")).toBe("/admin?range=last-week&orders=all&day=2026-09-23");
    expect(serviceLegendHref({ from: "2026-09-01", to: "2026-09-10" }, "premium")).toBe("/admin?from=2026-09-01&to=2026-09-10&orders=all&service=premium");
    expect(revenueTrendTitleHref("last-30-days")).toBe("/admin?range=last-30-days&metric=revenue");
  });

  it("labels the active filter", () => {
    expect(formatChartDay("2026-09-30")).toBe("Wed, Sep 30");
    expect(ordersFilterLabel({ day: "2026-09-30", serviceId: null }, "Sep 28 – Oct 4, 2026")).toBe("Booked Wed, Sep 30");
    expect(ordersFilterLabel({ day: null, serviceId: "premium" }, "Sep 28 – Oct 4, 2026")).toBe("Premium Clean · Sep 28 – Oct 4, 2026");
    expect(ordersFilterLabel({ day: "2026-09-30", serviceId: "premium" }, "x")).toBe("Premium Clean · Booked Wed, Sep 30");
    expect(ordersFilterLabel({ day: null, serviceId: null }, "x")).toBeNull();
  });
});
