import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it } from "vitest";
import { createSessionCookieValue, CUSTOMER_SESSION_COOKIE_NAME, SESSION_COOKIE_NAME } from "@/features/accounts/session";
import { POST as transition } from "./items/[itemId]/transitions/route";

// The proxy guards /api/v1/admin/*, but every admin route must also check
// on its own (ADR-0012): these call the handlers directly, as if the proxy
// were bypassed or misconfigured.

beforeEach(() => {
  process.env.SESSION_SECRET = "test-secret-0123456789abcdef0123456789abcdef0123456789abcdef";
});

const call = (cookie?: string) =>
  transition(
    new NextRequest("http://localhost/api/v1/admin/items/item_1/transitions", {
      method: "POST",
      headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
      body: JSON.stringify({ toStatus: "UNDER_REVIEW", fromStatus: "REQUEST_SUBMITTED", action: "REVIEW_STARTED" }),
    }),
    { params: Promise.resolve({ itemId: "item_1" }) },
  );

describe("admin API authorization, called directly (no proxy)", () => {
  it("refuses a request with no session", async () => {
    expect((await call()).status).toBe(403);
  });

  it("refuses a CUSTOMER session, in either cookie", async () => {
    const customer = await createSessionCookieValue("acc_c", "CUSTOMER");
    expect((await call(`${CUSTOMER_SESSION_COOKIE_NAME}=${customer}`)).status).toBe(403);
    expect((await call(`${SESSION_COOKIE_NAME}=${customer}`)).status).toBe(403);
  });

  it("refuses a malformed or forged admin cookie", async () => {
    expect((await call(`${SESSION_COOKIE_NAME}=x.!!!`)).status).toBe(403);
    const forged = Buffer.from(JSON.stringify({ accountId: "a", role: "ADMIN", exp: Date.now() + 1e7 })).toString("base64url");
    expect((await call(`${SESSION_COOKIE_NAME}=${forged}.AAAA`)).status).toBe(403);
  });
});

describe("every admin API route checks authorization itself", () => {
  const routeFiles = (dir: string): string[] =>
    readdirSync(dir).flatMap((entry) => {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) return routeFiles(full);
      return entry === "route.ts" ? [full] : [];
    });

  it.each(routeFiles(__dirname).map((f) => [path.relative(__dirname, f), f]))("%s calls checkAdminAccess", (_rel, file) => {
    expect(readFileSync(file, "utf8")).toMatch(/await checkAdminAccess\(/);
  });
});
