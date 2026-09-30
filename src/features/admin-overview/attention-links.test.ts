import { describe, expect, it } from "vitest";
import { attentionHref, closeAttentionHref, orderHref } from "./attention-links";

describe("attention links", () => {
  it("opens a panel, keeping the range params and nothing else", () => {
    expect(attentionHref({}, "pending-payments")).toBe("/admin?attention=pending-payments");
    expect(attentionHref({ range: "custom", from: "2026-09-01", to: "2026-09-07", order: "o1" }, "needs-quote")).toBe(
      "/admin?range=custom&from=2026-09-01&to=2026-09-07&attention=needs-quote",
    );
  });

  it("links an Order's dialog over the Overview, leaving the panel", () => {
    expect(orderHref({ range: "week", attention: "pending-payments" }, "o1")).toBe("/admin?range=week&order=o1");
  });

  it("closes a panel by dropping only its param", () => {
    expect(closeAttentionHref({ range: "week", attention: "needs-quote" })).toBe("/admin?range=week");
    expect(closeAttentionHref({ attention: "needs-quote" })).toBe("/admin");
  });
});
