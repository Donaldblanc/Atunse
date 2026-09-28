import { afterEach, describe, expect, it, vi } from "vitest";
import { emailDeliveryConfigured, notificationServiceFromEnv } from ".";
import { ConsoleNotificationService, maskEmail } from "./notification-service";
import { ResendNotificationService } from "./resend-notification-service";

describe("ResendNotificationService", () => {
  it("posts a plain-text email to Resend with the API key", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ id: "email_1" }), { status: 200 });
    }) as unknown as typeof fetch;

    await new ResendNotificationService("re_key", "Atunṣe <hello@example.com>", fetchImpl).sendEmail({
      to: "jordan@example.com",
      subject: "Hi",
      body: "Body",
    });

    expect(calls[0]?.url).toBe("https://api.resend.com/emails");
    expect((calls[0]?.init.headers as Record<string, string>).Authorization).toBe("Bearer re_key");
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({
      from: "Atunṣe <hello@example.com>",
      to: ["jordan@example.com"],
      subject: "Hi",
      text: "Body",
    });
  });

  it("sets reply_to only when the email has a replyTo", async () => {
    const bodies: Record<string, unknown>[] = [];
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(init.body as string));
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;
    const resend = new ResendNotificationService("re_key", "a@example.com", fetchImpl);
    await resend.sendEmail({ to: "shop@example.com", subject: "s", body: "b", replyTo: "jordan@example.com" });
    await resend.sendEmail({ to: "shop@example.com", subject: "s", body: "b" });
    expect(bodies[0]!.reply_to).toBe("jordan@example.com");
    expect(bodies[1]).not.toHaveProperty("reply_to");
  });

  it("throws when Resend rejects the email, so callers can retry", async () => {
    const fetchImpl = (async () => new Response("domain not verified", { status: 403 })) as unknown as typeof fetch;
    await expect(
      new ResendNotificationService("re_key", "a@example.com", fetchImpl).sendEmail({ to: "b@example.com", subject: "s", body: "b" }),
    ).rejects.toThrow(/403/);
  });
});

describe("notificationServiceFromEnv", () => {
  it("uses Resend only when both the key and sender are set", () => {
    expect(notificationServiceFromEnv({ NODE_ENV: "test", RESEND_API_KEY: "re_key", EMAIL_FROM: "a@example.com" })).toBeInstanceOf(
      ResendNotificationService,
    );
    expect(notificationServiceFromEnv({ NODE_ENV: "test", RESEND_API_KEY: "re_key" })).toBeInstanceOf(ConsoleNotificationService);
    expect(notificationServiceFromEnv({ NODE_ENV: "test", RESEND_API_KEY: " ", EMAIL_FROM: "a@example.com" })).toBeInstanceOf(
      ConsoleNotificationService,
    );
  });
});

describe("console fallback", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("never writes email subjects (which carry sign-in codes) to production logs", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await notificationServiceFromEnv({ NODE_ENV: "production" }).sendEmail({
      to: "jordan@example.com",
      subject: "123456 is your Atunṣe sign-in code",
      body: "Your sign-in code is 123456.",
    });
    const logged = log.mock.calls.flat().join(" ");
    expect(logged).not.toContain("123456");
    // Customer emails don't belong in production logs either: masked.
    expect(logged).not.toContain("jordan@example.com");
    expect(logged).toContain("j***@example.com");
  });

  it("shows subjects in development, where reading codes from the log is the point", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await notificationServiceFromEnv({ NODE_ENV: "development" }).sendEmail({ to: "a@b.co", subject: "123456 is your code", body: "" });
    expect(log.mock.calls.flat().join(" ")).toContain("123456");
  });

  it("reports email delivery as configured only with both RESEND_API_KEY and EMAIL_FROM", () => {
    expect(emailDeliveryConfigured({ NODE_ENV: "test", RESEND_API_KEY: "k", EMAIL_FROM: "a@b.co" })).toBe(true);
    expect(emailDeliveryConfigured({ NODE_ENV: "test", RESEND_API_KEY: "k" })).toBe(false);
  });
});

describe("maskEmail", () => {
  it("keeps only the first letter and the domain", () => {
    expect(maskEmail("jordan@example.com")).toBe("j***@example.com");
    expect(maskEmail("not-an-email")).toBe("***");
  });
});
