import { describe, expect, it } from "vitest";
import { notificationServiceFromEnv } from ".";
import { ConsoleNotificationService } from "./notification-service";
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
