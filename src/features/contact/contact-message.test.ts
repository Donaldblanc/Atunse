import { describe, expect, it } from "vitest";
import { RecordingNotificationService } from "@/features/orders/use-cases/test-fixtures";
import {
  contactInboxFromEnv,
  ContactInboxNotConfiguredError,
  ContactValidationError,
  sendContactMessage,
  type ContactMessageInput,
} from "./contact-message";

const NOW = new Date("2026-09-28T14:00:00Z");

function input(overrides: Partial<ContactMessageInput> = {}): ContactMessageInput {
  return {
    firstName: " Jordan ",
    lastName: "Smith",
    email: "jordan@example.com",
    phone: "",
    topic: "custom",
    message: "Can you dye my AF1s black?",
    consent: true,
    ...overrides,
  };
}

function deps(inbox: string | null = "shop@example.com") {
  return { notifications: new RecordingNotificationService(), inbox, now: () => NOW };
}

describe("sendContactMessage", () => {
  it("emails the shop's inbox with Reply-To set to the customer", async () => {
    const d = deps();
    await sendContactMessage(d, input({ phone: "(212) 555-0142" }));
    expect(d.notifications.sent).toHaveLength(1);
    const email = d.notifications.sent[0]!;
    expect(email.to).toBe("shop@example.com");
    expect(email.replyTo).toBe("jordan@example.com");
    expect(email.subject).toBe("Contact form: Custom request from Jordan Smith");
    expect(email.body).toContain("Can you dye my AF1s black?");
    expect(email.body).toContain("Phone: (212) 555-0142");
    expect(email.body).toContain("Privacy Policy (version 2026-09-27-v1) at 2026-09-28T14:00:00.000Z");
  });

  it("keeps names on one line, so nothing can reach past the subject", async () => {
    const d = deps();
    await sendContactMessage(d, input({ firstName: "Jor\r\ndan", lastName: "Smith\nBcc: x@example.com" }));
    expect(d.notifications.sent[0]!.subject).not.toMatch(/[\r\n]/);
  });

  it.each([
    ["no name", { firstName: "  " }],
    ["a bad email", { email: "jordan@" }],
    ["a bad phone", { phone: "555" }],
    ["an unknown topic", { topic: "refunds-now" }],
    ["an empty message", { message: "   " }],
    ["a message over 500 characters", { message: "x".repeat(501) }],
    ["no consent", { consent: false }],
  ])("refuses %s without sending anything", async (_label, overrides) => {
    const d = deps();
    await expect(sendContactMessage(d, input(overrides))).rejects.toThrow(ContactValidationError);
    expect(d.notifications.sent).toHaveLength(0);
  });

  it("refuses to pretend a message was sent when there's no inbox", async () => {
    await expect(sendContactMessage(deps(null), input())).rejects.toThrow(ContactInboxNotConfiguredError);
  });

  it("lets a provider failure reach the route, which tells the customer to retry", async () => {
    const d = deps();
    d.notifications.failing = true;
    await expect(sendContactMessage(d, input())).rejects.toThrow("email provider unavailable");
  });
});

describe("contactInboxFromEnv", () => {
  it("uses CONTACT_EMAIL, a logged placeholder in development, and nothing in production", () => {
    expect(contactInboxFromEnv({ NODE_ENV: "production", CONTACT_EMAIL: " shop@example.com " })).toBe("shop@example.com");
    expect(contactInboxFromEnv({ NODE_ENV: "development" })).toBe("contact-inbox@localhost");
    expect(contactInboxFromEnv({ NODE_ENV: "production" })).toBeNull();
  });
});
