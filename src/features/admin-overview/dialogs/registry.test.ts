import { describe, expect, it } from "vitest";
import { matchingDialogIds } from "./registry";

const ids = (query: string) => matchingDialogIds(Object.fromEntries(new URLSearchParams(query)));

describe("overview dialog registry", () => {
  it("opens nothing for bare params", () => expect(ids("")).toEqual([]));
  it("opens the metric dialog", () => expect(ids("metric=orders")).toEqual(["metric"]));
  it("ignores an unknown metric", () => expect(ids("metric=bogus")).toEqual([]));
  it("opens the order dialog", () => expect(ids("order=x")).toEqual(["order"]));
  it("opens only the return picker for book=return", () => expect(ids("order=x&book=return")).toEqual(["return-booking"]));
  it("opens the visit dialog (reschedule is the same slot)", () => expect(ids("visit=x&reschedule=1")).toEqual(["visit"]));
  it("opens the attention panel", () => expect(ids("attention=pending-payments")).toEqual(["attention"]));
  it("opens the unread messages dialog", () => expect(ids("attention=messages")).toEqual(["messages"]));
  it("opens the low stock panel", () => expect(ids("attention=low-stock")).toEqual(["low-stock"]));
  it("opens the reviews dialog", () => expect(ids("reviews=all")).toEqual(["reviews"]));
  it("ignores an unknown reviews value", () => expect(ids("reviews=x")).toEqual([]));
  it("opens All orders only for orders=all", () => {
    expect(ids("orders=all&q=ATU-1001&status=APPROVED&page=2")).toEqual(["all-orders"]);
    expect(ids("orders=bogus")).toEqual([]);
  });
  it("opens Upcoming visits only for visits=upcoming", () => {
    expect(ids("visits=upcoming")).toEqual(["upcoming-visits"]);
    expect(ids("visits=x")).toEqual([]);
  });
  it("renders every match in the page's old order", () =>
    expect(ids("attention=needs-quote&order=x&visit=y&metric=revenue")).toEqual(["metric", "visit", "order", "attention"]));
});
