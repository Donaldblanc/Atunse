import { describe, expect, it } from "vitest";
import { isValidEmail, isValidUsPhone, isValidZip } from "./contact-rules";

describe("contact rules", () => {
  it("accepts ordinary emails and rejects malformed ones", () => {
    expect(isValidEmail(" jordan@example.com ")).toBe(true);
    expect(isValidEmail("jordan@example")).toBe(false);
    expect(isValidEmail("jordan example.com")).toBe(false);
  });

  it("accepts US phone numbers in any formatting", () => {
    expect(isValidUsPhone("(212) 555-0142")).toBe(true);
    expect(isValidUsPhone("+1 212 555 0142")).toBe(true);
    expect(isValidUsPhone("555-0142")).toBe(false);
    expect(isValidUsPhone("2 212 555 0142")).toBe(false);
  });

  it("accepts 5-digit and ZIP+4 codes", () => {
    expect(isValidZip("10001")).toBe(true);
    expect(isValidZip("10001-1234")).toBe(true);
    expect(isValidZip("1000")).toBe(false);
  });
});
