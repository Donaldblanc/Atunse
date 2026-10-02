import { describe, expect, it } from "vitest";
import { UnauthorizedError, type ActingUser } from "@/features/accounts/authz";
import { collectionTimes } from "@/features/orders/pickup-window";
import { InMemoryOrderRepository } from "@/features/orders/repositories/in-memory-order-repository";
import { AppointmentCancelledError, AppointmentNotFoundError } from "@/features/orders/repositories/order-repository";
import { validBookingInput } from "@/features/orders/use-cases/test-fixtures";
import { Money } from "@/shared/money/money";
import { completeAppointment } from "./complete-appointment";

const ADMIN: ActingUser = { accountId: "acc_admin", role: "ADMIN" };

async function seed() {
  const orders = new InMemoryOrderRepository();
  const { order } = await orders.create({
    owner: { newCustomer: { email: "c@example.com", phone: "2125550142" } },
    contactName: "Sarah Kim",
    contactEmail: "c@example.com",
    contactPhone: "2125550142",
    policyAcceptedAt: new Date(),
    terms: { version: "v1", url: "/terms.pdf", sha256: "x", acknowledgments: {} },
    fulfillment: validBookingInput().fulfillment,
    rush: false,
    estimate: Money.fromCents(4000),
    estimateIsMinimum: false,
    deposit: Money.fromCents(2000),
    depositPayment: null,
    collection: collectionTimes("2026-09-26", "6:00 PM – 6:30 PM"),
    submissionKey: null,
    submissionFingerprint: null,
    bundleId: null,
    alertBody: "Jordan · Standard Clean · Mail-In",
    items: [{ brand: null, model: null, description: null, material: null, serviceIds: ["premium"], estimate: Money.fromCents(4000), photos: [] }],
  });
  return { orders, order, appointmentId: order.appointments[0]!.id };
}

describe("completeAppointment", () => {
  it("is admin-only", async () => {
    const { orders, appointmentId } = await seed();
    await expect(completeAppointment({ orders }, { accountId: "acc_c", role: "CUSTOMER" }, { appointmentId })).rejects.toThrow(UnauthorizedError);
    expect((await orders.findAppointment(appointmentId))!.appointment.status).toBe("SCHEDULED");
  });

  it("marks a SCHEDULED Appointment COMPLETED and leaves pairs that aren't approved where they are", async () => {
    const { orders, order, appointmentId } = await seed();

    const done = await completeAppointment({ orders }, ADMIN, { appointmentId });

    expect(done.appointment.status).toBe("COMPLETED");
    expect((await orders.findAppointment(appointmentId))!.appointment.status).toBe("COMPLETED");
    expect(order.items[0]!.status).toBe("REQUEST_SUBMITTED");
  });

  it("succeeds again when it is already COMPLETED", async () => {
    const { orders, appointmentId } = await seed();
    await completeAppointment({ orders }, ADMIN, { appointmentId });
    expect((await completeAppointment({ orders }, ADMIN, { appointmentId })).appointment.status).toBe("COMPLETED");
  });

  it("refuses a CANCELLED Appointment and changes nothing", async () => {
    const { orders, order, appointmentId } = await seed();
    order.appointments[0]!.status = "CANCELLED";
    await expect(completeAppointment({ orders }, ADMIN, { appointmentId })).rejects.toThrow(AppointmentCancelledError);
    expect(order.appointments[0]!.status).toBe("CANCELLED");
  });

  it("refuses an id no Appointment has", async () => {
    const { orders } = await seed();
    await expect(completeAppointment({ orders }, ADMIN, { appointmentId: "missing" })).rejects.toThrow(AppointmentNotFoundError);
  });

  describe("moving the pairs", () => {
    it("takes each Awaiting Sneakers pair to In Progress, audited as COLLECTION_COMPLETED, and says who stayed and why", async () => {
      const { orders, order, appointmentId } = await seed();
      const second = { ...order.items[0]!, id: "item_second" };
      const third = { ...order.items[0]!, id: "item_third" };
      order.items.push(second, third);
      order.items[0]!.status = "AWAITING_SNEAKERS";
      second.status = "UNDER_REVIEW";
      third.status = "CANCELLED";

      const done = await completeAppointment({ orders }, ADMIN, { appointmentId });

      expect(done.moves).toEqual([{ itemId: order.items[0]!.id, from: "AWAITING_SNEAKERS", to: "IN_PROGRESS" }]);
      expect(done.stays).toEqual([{ itemId: "item_second", status: "UNDER_REVIEW", reason: "Not approved yet." }]);
      expect(order.items.map((item) => item.status)).toEqual(["IN_PROGRESS", "UNDER_REVIEW", "CANCELLED"]);
      expect(orders.auditEntries).toEqual([
        expect.objectContaining({
          itemId: order.items[0]!.id,
          action: "STATUS_TRANSITION",
          fromStatus: "AWAITING_SNEAKERS",
          toStatus: "IN_PROGRESS",
          actorAccountId: "acc_admin",
          metadata: { reason: "COLLECTION_COMPLETED" },
        }),
      ]);
    });

    it("moves nothing on a replay", async () => {
      const { orders, order, appointmentId } = await seed();
      order.items[0]!.status = "AWAITING_SNEAKERS";
      await completeAppointment({ orders }, ADMIN, { appointmentId });
      order.items[0]!.status = "AWAITING_SNEAKERS"; // pretend it is back, to prove the replay doesn't act

      const again = await completeAppointment({ orders }, ADMIN, { appointmentId });

      expect(again).toMatchObject({ moves: [], stays: [], alreadyCompleted: true });
      expect(order.items[0]!.status).toBe("AWAITING_SNEAKERS");
      expect(orders.auditEntries).toHaveLength(1);
    });

    it("takes a Return's Ready pairs to Completed, unless a Balance is still pending", async () => {
      const { orders, order } = await seed();
      order.items[0]!.status = "READY_FOR_PICKUP_SHIPPING";
      const returnVisit = { id: "appt_return", kind: "RETURN" as const, status: "SCHEDULED" as const, startsAt: new Date(), endsAt: new Date(), notes: null };
      order.appointments.push(returnVisit);
      order.payments.push({ id: "pay_balance", kind: "BALANCE", method: "ZELLE", amount: Money.fromCents(2000), status: "PENDING", receivedAt: null, createdAt: new Date() });

      const held = await completeAppointment({ orders }, ADMIN, { appointmentId: "appt_return" });

      expect(held.moves).toEqual([]);
      expect(held.stays).toEqual([expect.objectContaining({ status: "READY_FOR_PICKUP_SHIPPING", reason: expect.stringContaining("Balance") })]);
      expect(order.items[0]!.status).toBe("READY_FOR_PICKUP_SHIPPING");

      returnVisit.status = "SCHEDULED";
      order.payments[order.payments.length - 1]!.status = "RECEIVED";
      const done = await completeAppointment({ orders }, ADMIN, { appointmentId: "appt_return" });

      expect(done.moves).toEqual([{ itemId: order.items[0]!.id, from: "READY_FOR_PICKUP_SHIPPING", to: "COMPLETED" }]);
      expect(orders.auditEntries.at(-1)).toMatchObject({ toStatus: "COMPLETED", metadata: { reason: "RETURN_COMPLETED" } });
    });
  });
});
