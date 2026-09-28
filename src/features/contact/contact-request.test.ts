import { describe, expect, it } from "vitest";
import { parseContactRequest } from "./contact-request";

const body = {
  firstName: "Jordan",
  lastName: "Smith",
  email: "jordan@example.com",
  topic: "general",
  message: "Hi",
  consent: true,
};

describe("parseContactRequest", () => {
  it("parses a message, with a missing phone as blank", () => {
    expect(parseContactRequest(body)).toEqual({ ok: true, value: { ...body, phone: "" }, isBot: false });
  });

  it("flags a filled-in honeypot as a bot", () => {
    const result = parseContactRequest({ ...body, website: "http://spam.example" });
    expect(result.ok && result.isBot).toBe(true);
  });

  it("names the offending field", () => {
    expect(parseContactRequest({ ...body, consent: "yes" })).toEqual({ ok: false, error: expect.stringContaining("consent") });
  });
});
