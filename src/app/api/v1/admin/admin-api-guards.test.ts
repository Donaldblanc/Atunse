import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { POST as logoUpload } from "./settings/logo-upload/route";
import { POST as transition } from "./items/[itemId]/transitions/route";

// A signed-in admin; what's under test is what the routes refuse after that.
vi.mock("@/features/accounts/admin-check", () => ({
  checkAdminAccess: async () => ({ allowed: true, role: "ADMIN", accountId: "acc_admin" }),
}));

const goodBody = { fromStatus: "REQUEST_SUBMITTED", toStatus: "UNDER_REVIEW", action: "STATUS_TRANSITION" };
const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  new NextRequest(`http://localhost:3000${path}`, {
    method: "POST",
    headers: { host: "localhost:3000", "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
const ctx = { params: Promise.resolve({ itemId: "item_1" }) };
const transitionReq = (body: unknown, headers?: Record<string, string>) => transition(post("/api/v1/admin/items/item_1/transitions", body, headers), ctx);
const logoReq = (headers?: Record<string, string>) => logoUpload(post("/api/v1/admin/settings/logo-upload", { contentType: "image/png", size: 10 }, headers));

describe("transitions route request guards", () => {
  it("refuses a cross-origin request (403) and a non-JSON content type (415)", async () => {
    expect((await transitionReq(goodBody, { origin: "https://evil.example" })).status).toBe(403);
    expect((await transitionReq(JSON.stringify(goodBody), { "content-type": "text/plain" })).status).toBe(415);
  });

  it("only accepts the STATUS_TRANSITION action", async () => {
    for (const action of ["MANUAL_PAYMENT_CONFIRMED", "REVIEW_STARTED", "", undefined, 5]) {
      const res = await transitionReq({ ...goodBody, action });
      expect(res.status).toBe(400);
    }
  });
});

describe("logo-upload route request guards", () => {
  it("refuses a cross-origin request (403) and a non-JSON content type (415)", async () => {
    expect((await logoReq({ origin: "https://evil.example" })).status).toBe(403);
    expect((await logoReq({ "content-type": "application/x-www-form-urlencoded" })).status).toBe(415);
  });
});
