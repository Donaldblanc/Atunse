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

  it("marks a SCHEDULED Appointment COMPLETED and leaves the pairs' statuses alone", async () => {
    const { orders, order, appointmentId } = await seed();

    const done = await completeAppointment({ orders }, ADMIN, { appointmentId });

    expect(done.status).toBe("COMPLETED");
    expect((await orders.findAppointment(appointmentId))!.appointment.status).toBe("COMPLETED");
    expect(order.items[0]!.status).toBe("REQUEST_SUBMITTED");
  });

  it("succeeds again when it is already COMPLETED", async () => {
    const { orders, appointmentId } = await seed();
    await completeAppointment({ orders }, ADMIN, { appointmentId });
    expect((await completeAppointment({ orders }, ADMIN, { appointmentId })).status).toBe("COMPLETED");
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
});
