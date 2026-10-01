import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSessionCookieValue, SESSION_COOKIE_NAME } from "@/features/accounts/session";

let cookieValue: string | undefined;
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (name === SESSION_COOKIE_NAME && cookieValue !== undefined ? { value: cookieValue } : undefined) }),
}));
class RedirectSignal extends Error {}
const redirect = vi.fn((url: string) => {
  throw new RedirectSignal(url);
});
vi.mock("next/navigation", () => ({ redirect: (url: string) => redirect(url) }));

vi.mock("./notification-bell", () => ({ NotificationBell: () => null }));

const { default: AdminLayout } = await import("./layout");

beforeEach(() => {
  process.env.SESSION_SECRET = "test-secret-0123456789abcdef0123456789abcdef0123456789abcdef";
  redirect.mockClear();
});

describe("admin layout guard (defense in depth behind src/proxy.ts)", () => {
  it.each([
    ["no session", async () => undefined],
    ["a malformed cookie", async () => "x.!!!"],
    ["a CUSTOMER session", async () => createSessionCookieValue("acc_c", "CUSTOMER")],
  ])("redirects %s to /sign-in", async (_label, cookie) => {
    cookieValue = await cookie();
    await expect(AdminLayout({ children: null })).rejects.toBeInstanceOf(RedirectSignal);
    expect(redirect).toHaveBeenCalledWith("/sign-in");
  });

  it("renders for an ADMIN session", async () => {
    cookieValue = await createSessionCookieValue("acc_a", "ADMIN");
    await expect(AdminLayout({ children: null })).resolves.toBeTruthy();
    expect(redirect).not.toHaveBeenCalled();
  });
});
