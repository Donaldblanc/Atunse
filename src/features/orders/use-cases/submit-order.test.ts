import { describe, expect, it } from "vitest";
import { UnauthorizedError } from "@/features/accounts/authz";
import { orderReference } from "../domain";
import { BookingValidationError, PolicyNotAcceptedError, SignInRequiredError, submitOrder } from "./submit-order";
import { bookingDeps, FIXED_NOW, validBookingInput } from "./test-fixtures";

const guest = { accountId: null, role: "GUEST" as const };
const mailInAddress = { line1: "1 Elm St", line2: null, city: "Austin", state: "TX", zip: "73301" };

describe("submitOrder", () => {
  it("creates an order with one REQUEST_SUBMITTED item as a guest", async () => {
    const order = await submitOrder(bookingDeps(), guest, validBookingInput());
    expect(order.items).toHaveLength(1);
    expect(order.items[0]?.status).toBe("REQUEST_SUBMITTED");
    expect(order.items[0]?.brand).toBe("Nike Air Force 1");
    expect(order.items[0]?.description).toBe("scuffed toe box");
    expect(order.contactName).toBe("Jordan Smith");
  });

  it("rejects submission without policy acceptance", async () => {
    await expect(submitOrder(bookingDeps(), guest, validBookingInput({ policyAccepted: false }))).rejects.toThrow(
      PolicyNotAcceptedError,
    );
  });

  it("rejects an admin trying to submit an order as themselves", async () => {
    await expect(submitOrder(bookingDeps(), { accountId: "acc_1", role: "ADMIN" }, validBookingInput())).rejects.toThrow(
      UnauthorizedError,
    );
  });

  describe("account ownership (ADR-0014)", () => {
    const secondPhoto = (input: ReturnType<typeof validBookingInput>) => {
      input.item = { ...input.item, photoKeys: ["bookings/0b6e8c1e-3f7a-4c2d-9e1b-5a4f3c2d1e0f/1.jpg"] };
      return input;
    };

    it("creates a Customer Account for a new email, stored lowercased", async () => {
      const deps = bookingDeps();
      const input = validBookingInput({ contact: { name: "Jordan", email: "Jordan@Example.com", phone: "2125550142" } });
      const order = await submitOrder(deps, guest, input);

      expect(await deps.accounts.findCustomerByEmail("jordan@example.com")).toEqual({
        id: order.accountId,
        email: "jordan@example.com",
      });
      expect(order.contactEmail).toBe("Jordan@Example.com");
    });

    it("with customer login ON, asks a signed-out booking with a registered email to sign in, creating nothing", async () => {
      const deps = bookingDeps({ customerSignInEnabled: true });
      await submitOrder(deps, guest, validBookingInput());

      const again = secondPhoto(validBookingInput({ contact: { name: "Other", email: "CUSTOMER@example.com", phone: "2125550199" } }));
      await expect(submitOrder(deps, guest, again)).rejects.toThrow(SignInRequiredError);
      expect(deps.orders.orders.size).toBe(1);
    });

    it("with customer login OFF, attaches a registered email's booking to that Account", async () => {
      const deps = bookingDeps({ customerSignInEnabled: false });
      const first = await submitOrder(deps, guest, validBookingInput());
      const second = await submitOrder(deps, guest, secondPhoto(validBookingInput()));
      expect(second.accountId).toBe(first.accountId);
      expect(deps.orders.orders.size).toBe(2);
    });

    it.each([true, false])(
      "books an admin's email into a separate Customer Account, never the Admin Account (login %s)",
      async (customerSignInEnabled) => {
        const deps = bookingDeps({ customerSignInEnabled });
        const admin = deps.accounts.add({ role: "ADMIN", email: "owner@restoredbydj.com" });

        const order = await submitOrder(
          deps,
          guest,
          validBookingInput({ contact: { name: "DJ", email: "Owner@RestoredByDJ.com", phone: "2125550100" } }),
        );
        expect(order.accountId).not.toBe(admin.id);
        expect(deps.accounts.accounts.find((a) => a.id === order.accountId)).toMatchObject({
          role: "CUSTOMER",
          email: "owner@restoredbydj.com",
        });
      },
    );

    it("books a signed-in customer into their own Account when the email is theirs", async () => {
      const deps = bookingDeps({ customerSignInEnabled: true });
      const first = await submitOrder(deps, guest, validBookingInput());
      const customer = { accountId: first.accountId, role: "CUSTOMER" as const };

      const second = await submitOrder(deps, customer, secondPhoto(validBookingInput()));
      expect(second.accountId).toBe(first.accountId);
    });

    it("ignores a signed-in session when the booking is under someone else's email (shared browser)", async () => {
      const deps = bookingDeps({ customerSignInEnabled: true });
      const first = await submitOrder(deps, guest, validBookingInput());
      const customer = { accountId: first.accountId, role: "CUSTOMER" as const };

      const friend = secondPhoto(validBookingInput({ contact: { name: "Friend", email: "friend@example.com", phone: "2125550177" } }));
      const second = await submitOrder(deps, customer, friend);
      expect(second.accountId).not.toBe(first.accountId);
      expect((await deps.accounts.findCustomerByEmail("friend@example.com"))?.id).toBe(second.accountId);
    });

    it("recovers when a concurrent first booking takes the email between lookup and insert", async () => {
      const deps = bookingDeps({ customerSignInEnabled: false });
      // The lookup says "new", but the account appears before the insert.
      const lookup = deps.accounts.findCustomerByEmail.bind(deps.accounts);
      let calls = 0;
      deps.accounts.findCustomerByEmail = async (email) => {
        calls += 1;
        if (calls === 1) {
          deps.accounts.add({ role: "CUSTOMER", email });
          return null;
        }
        return lookup(email);
      };

      const order = await submitOrder(deps, guest, validBookingInput());
      expect(order.accountId).toBe((await lookup("customer@example.com"))?.id);
      expect(deps.accounts.accounts.filter((a) => a.email === "customer@example.com")).toHaveLength(1);
    });

    it("refuses photo keys already attached to another booking", async () => {
      const deps = bookingDeps();
      await submitOrder(deps, guest, validBookingInput());

      const stolen = validBookingInput({ contact: { name: "Eve", email: "eve@example.com", phone: "2125550100" } });
      await expect(submitOrder(deps, guest, stolen)).rejects.toThrow(/already attached to another booking/);
    });
  });

  describe("pricing", () => {
    it("computes the estimate and 50% Deposit from the server catalog, with Suede and Rush", async () => {
      const input = validBookingInput({ rush: true });
      input.item = { ...input.item, material: "Suede", serviceIds: ["standard", "oxidation"] };
      const order = await submitOrder(bookingDeps(), guest, input);

      // 30 standard + 25 oxidation + 10 suede = 65 per pair; + 20 rush = 85
      expect(order.items[0]?.estimate.cents).toBe(6500);
      expect(order.estimate.cents).toBe(8500);
      expect(order.estimateIsMinimum).toBe(true);
      expect(order.deposit.cents).toBe(4250);
    });

    it("rejects invalid Service selections as a booking validation error", async () => {
      const input = validBookingInput();
      input.item = { ...input.item, serviceIds: ["standard", "premium"] };
      await expect(submitOrder(bookingDeps(), guest, input)).rejects.toThrow(BookingValidationError);
    });

    it("rejects an unknown material", async () => {
      const input = validBookingInput();
      input.item = { ...input.item, material: "Velvet" };
      await expect(submitOrder(bookingDeps(), guest, input)).rejects.toThrow(BookingValidationError);
    });
  });

  describe("photos", () => {
    it.each([
      ["no photos", []],
      ["a key the server didn't mint", ["../../etc/passwd"]],
      ["too many photos", Array.from({ length: 11 }, (_, i) => `bookings/0b6e8c1e-3f7a-4c2d-9e1b-5a4f3c2d1e0f/${i}.jpg`)],
    ])("rejects %s", async (_label, photoKeys) => {
      const input = validBookingInput();
      input.item = { ...input.item, photoKeys };
      await expect(submitOrder(bookingDeps(), guest, input)).rejects.toThrow(BookingValidationError);
    });
  });

  describe("fulfillment", () => {
    it("rejects Pickup outside NY/NJ/CT", async () => {
      const input = validBookingInput({
        fulfillment: { method: "PICKUP", address: mailInAddress, date: "2026-10-03", slot: "4:30 PM – 5:00 PM" },
      });
      await expect(submitOrder(bookingDeps(), guest, input)).rejects.toThrow(/only available in NY, NJ and CT/);
    });

    it("rejects a pickup date in the past (New York time) but accepts today", async () => {
      const base = validBookingInput().fulfillment;
      if (base.method !== "PICKUP") throw new Error("fixture must be a pickup");
      await expect(
        submitOrder(bookingDeps(), guest, validBookingInput({ fulfillment: { ...base, date: "2026-09-30" } })),
      ).rejects.toThrow(BookingValidationError);
      await expect(
        submitOrder(bookingDeps(), guest, validBookingInput({ fulfillment: { ...base, date: "2026-10-01" } })),
      ).resolves.toBeDefined();
    });

    it("rejects an impossible date and a slot outside the pickup window", async () => {
      const base = validBookingInput().fulfillment;
      if (base.method !== "PICKUP") throw new Error("fixture must be a pickup");
      await expect(
        submitOrder(bookingDeps(), guest, validBookingInput({ fulfillment: { ...base, date: "2026-02-30" } })),
      ).rejects.toThrow(BookingValidationError);
      await expect(
        submitOrder(bookingDeps(), guest, validBookingInput({ fulfillment: { ...base, slot: "9:00 AM – 9:30 AM" } })),
      ).rejects.toThrow(BookingValidationError);
    });

    it("rejects a same-day pickup slot that has passed or is under 2 hours away (#75)", async () => {
      const base = validBookingInput().fulfillment;
      if (base.method !== "PICKUP") throw new Error("fixture must be a pickup");
      const at = (iso: string) => bookingDeps({ now: () => new Date(iso) });

      // 9:45 PM EDT: today's 4:30 PM slot is long gone.
      await expect(
        submitOrder(at("2026-10-02T01:45:00Z"), guest, validBookingInput({ fulfillment: { ...base, date: "2026-10-01" } })),
      ).rejects.toThrow(/no longer available/);
      // 3:00 PM EDT: 4:30 PM is only 1.5 hours away, 5:00 PM is exactly 2.
      await expect(
        submitOrder(at("2026-10-01T19:00:00Z"), guest, validBookingInput({ fulfillment: { ...base, date: "2026-10-01" } })),
      ).rejects.toThrow(/no longer available/);
      await expect(
        submitOrder(
          at("2026-10-01T19:00:00Z"),
          guest,
          validBookingInput({ fulfillment: { ...base, date: "2026-10-01", slot: "5:00 PM – 5:30 PM" } }),
        ),
      ).resolves.toBeDefined();
    });

    it("judges 'today' by New York's date, not the customer's (#75)", async () => {
      const mailIn = (preferredDate: string) =>
        validBookingInput({ fulfillment: { method: "MAIL_IN", address: mailInAddress, preferredDate } });
      // 12:30 AM Oct 2 in New York = 9:30 PM Oct 1 in California: Oct 1 is past.
      const pastMidnight = bookingDeps({ now: () => new Date("2026-10-02T04:30:00Z") });
      await expect(submitOrder(pastMidnight, guest, mailIn("2026-10-01"))).rejects.toThrow(/from today onward/);
      // 11:30 PM Oct 1 in New York (already Oct 2 in UTC): Oct 1 is still today.
      const lateNight = bookingDeps({ now: () => new Date("2026-10-02T03:30:00Z") });
      await expect(submitOrder(lateNight, guest, mailIn("2026-10-01"))).resolves.toBeDefined();
    });

    it("accepts a nationwide Mail-In order with no preferred date", async () => {
      const input = validBookingInput({ fulfillment: { method: "MAIL_IN", address: mailInAddress, preferredDate: null } });
      const order = await submitOrder(bookingDeps(), guest, input);
      expect(order.fulfillment).toEqual({ method: "MAIL_IN", address: mailInAddress, preferredDate: null });
    });

    it("rejects a malformed zip", async () => {
      const input = validBookingInput({
        fulfillment: { method: "MAIL_IN", address: { ...mailInAddress, zip: "7330" }, preferredDate: null },
      });
      await expect(submitOrder(bookingDeps(), guest, input)).rejects.toThrow(BookingValidationError);
    });
  });

  describe("contact", () => {
    it.each([
      ["a blank name", { name: "  ", email: "a@b.co", phone: "2125550142" }],
      ["a malformed email", { name: "J", email: "not-an-email", phone: "2125550142" }],
      ["a short phone", { name: "J", email: "a@b.co", phone: "555-0142" }],
    ])("rejects %s", async (_label, contact) => {
      await expect(submitOrder(bookingDeps(), guest, validBookingInput({ contact }))).rejects.toThrow(
        BookingValidationError,
      );
    });
  });

  describe("notification and idempotency", () => {
    it("emails the customer their reference, Deposit and Zelle instructions", async () => {
      const deps = bookingDeps();
      const order = await submitOrder(deps, guest, validBookingInput());

      expect(deps.notifications.sent).toHaveLength(1);
      const email = deps.notifications.sent[0]!;
      expect(email.to).toBe("customer@example.com");
      expect(email.subject).toContain(orderReference(order.id));
      expect(email.body).toContain("Deposit due: $15");
      expect(email.body).toContain("pay@restoredbydj.com");
    });

    it("says instructions will follow when no Zelle recipient is configured", async () => {
      const deps = bookingDeps({ paymentInstructions: { zelle: null } });
      await submitOrder(deps, guest, validBookingInput());
      expect(deps.notifications.sent[0]?.body).toContain("We'll email you how to pay");
    });

    it("returns the same order and sends no second email for a retried submission key", async () => {
      const deps = bookingDeps();
      const input = validBookingInput({ submissionKey: "3c1f0e2a-7d4b-4a8e-9f6c-1b2d3e4f5a6b" });
      const first = await submitOrder(deps, guest, input);
      const retry = await submitOrder(deps, guest, input);

      expect(retry.id).toBe(first.id);
      expect(deps.orders.orders.size).toBe(1);
      expect(deps.notifications.sent).toHaveLength(1);
    });

    it("sends the email on retry when the first send failed after the order was created", async () => {
      const deps = bookingDeps();
      const input = validBookingInput({ submissionKey: "7a2e9c41-5b3d-4f6a-8e1c-2d4b6f8a0c3e" });

      deps.notifications.failing = true;
      await expect(submitOrder(deps, guest, input)).rejects.toThrow("email provider unavailable");
      expect(deps.orders.orders.size).toBe(1);
      expect([...deps.orders.orders.values()][0]?.confirmationEmailSentAt).toBeNull();

      deps.notifications.failing = false;
      const retry = await submitOrder(deps, guest, input);
      expect(deps.orders.orders.size).toBe(1);
      expect(deps.notifications.sent).toHaveLength(1);
      expect(retry.confirmationEmailSentAt).toEqual(FIXED_NOW);

      await submitOrder(deps, guest, input);
      expect(deps.notifications.sent).toHaveLength(1);
    });
  });
});
