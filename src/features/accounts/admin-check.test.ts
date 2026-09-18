import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { checkAdminAccess } from "./admin-check";

function req(path: string): NextRequest {
  return new NextRequest(new URL(path, "http://localhost:3000"));
}

describe("checkAdminAccess", () => {
  it("fails closed: nobody is ADMIN until a real auth provider is wired in (ADR-0005)", () => {
    const result = checkAdminAccess(req("/admin"));
    expect(result.allowed).toBe(false);
    expect(result.role).not.toBe("ADMIN");
  });

  it("never grants access regardless of the requested path", () => {
    expect(checkAdminAccess(req("/admin/orders")).allowed).toBe(false);
    expect(checkAdminAccess(req("/api/v1/admin/items/123/transitions")).allowed).toBe(false);
  });
});
