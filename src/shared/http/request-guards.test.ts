import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { rejectCrossSiteOrNonJson } from "./request-guards";

const req = (headers: Record<string, string>) =>
  new NextRequest("http://localhost:3000/api/v1/admin/x", { method: "POST", headers: { host: "localhost:3000", ...headers } });

describe("rejectCrossSiteOrNonJson", () => {
  it("allows a same-origin JSON request", () => {
    expect(rejectCrossSiteOrNonJson(req({ origin: "http://localhost:3000", "content-type": "application/json" }))).toBeNull();
    expect(rejectCrossSiteOrNonJson(req({ origin: "http://localhost:3000", "content-type": "application/json; charset=utf-8" }))).toBeNull();
  });

  it("allows a request with no Origin header (non-browser client), as Next does for Server Actions", () => {
    expect(rejectCrossSiteOrNonJson(req({ "content-type": "application/json" }))).toBeNull();
  });

  it("refuses another origin, a null origin and garbage with 403", async () => {
    for (const origin of ["https://evil.example", "null", "not a url", "http://localhost:3001"]) {
      expect(rejectCrossSiteOrNonJson(req({ origin, "content-type": "application/json" }))?.status).toBe(403);
    }
  });

  it("trusts X-Forwarded-Host over Host, as behind a proxy", () => {
    const behindProxy = req({ host: "internal:3000", "x-forwarded-host": "atunse.example", origin: "https://atunse.example", "content-type": "application/json" });
    expect(rejectCrossSiteOrNonJson(behindProxy)).toBeNull();
  });

  it("refuses non-JSON content types with 415", () => {
    for (const type of ["text/plain", "application/x-www-form-urlencoded", "multipart/form-data; boundary=x"]) {
      expect(rejectCrossSiteOrNonJson(req({ "content-type": type }))?.status).toBe(415);
    }
    expect(rejectCrossSiteOrNonJson(req({}))?.status).toBe(415);
  });
});
