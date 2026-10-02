import { describe, expect, it } from "vitest";
import { orderNumberFromQuery, phoneDigitsFromQuery } from "./order-search-repository";

describe("orderNumberFromQuery", () => {
  it.each([
    ["ATU-1234", 1234],
    ["atu1234", 1234],
    [" 1234 ", 1234],
  ])("reads %j as an order number", (q, number) => expect(orderNumberFromQuery(q)).toBe(number));

  it.each(["Sam", "ATU-", "12-34"])("leaves %j alone", (q) => expect(orderNumberFromQuery(q)).toBeNull());
});

describe("phoneDigitsFromQuery", () => {
  it.each([
    ["(347) 555-0111", "3475550111"],
    ["347.555.0111", "3475550111"],
    ["+1 347 555 0111", "3475550111"],
    ["555-01", "55501"],
  ])("reads %j as phone digits", (q, digits) => expect(phoneDigitsFromQuery(q)).toBe(digits));

  it.each(["Sam", "sam@example.com", "12", "ATU-1234"])("leaves %j alone", (q) => expect(phoneDigitsFromQuery(q)).toBeNull());
});
