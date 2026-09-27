import { describe, expect, it } from "vitest";
import { UnauthorizedError } from "@/features/accounts/authz";
import { orderReference } from "../domain";
import { BookingValidationError, PolicyNotAcceptedError, submitOrder } from "./submit-order";
import { bookingDeps, validBookingInput } from "./test-fixtures";

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
  });
});
