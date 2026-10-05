import { describe, expect, it } from "vitest";
import { UnauthorizedError, type ActingUser } from "@/features/accounts/authz";
import { Money } from "@/shared/money/money";
import type { Fulfillment } from "../domain";
import { collectionTimes } from "../pickup-window";
import { InMemoryOrderRepository } from "../repositories/in-memory-order-repository";
import {
  AppointmentMovedError,
  AppointmentNotFoundError,
  AppointmentNotScheduledError,
  OrderNotFoundError,
  ReturnAlreadyBookedError,
} from "../repositories/order-repository";
import { VisitSlotError } from "../visit-slot";
import { bookReturnVisit, ReturnNotAvailableError } from "./book-return-visit";
import { rescheduleVisit } from "./reschedule-visit";
import { FIXED_NOW, RecordingNotificationService, validBookingInput } from "./test-fixtures";

const ADMIN: ActingUser = { accountId: "acc_admin", role: "ADMIN" };
const CUSTOMER: ActingUser = { accountId: "acc_c", role: "CUSTOMER" };
const FIRST = collectionTimes("2026-10-03", "4:30 PM – 5:00 PM");

async function seed(fulfillment: Fulfillment = validBookingInput().fulfillment) {
  const orders = new InMemoryOrderRepository();
  const notifications = new RecordingNotificationService();
  const { order } = await orders.create({
    owner: { newCustomer: { email: "c@example.com", phone: "2125550142" } },
    contactName: "Sarah Kim",
    contactEmail: "c@example.com",
    contactPhone: "2125550142",
    policyAcceptedAt: new Date(),
    terms: { version: "v1", url: "/terms.pdf", sha256: "x", acknowledgments: {} },
    fulfillment,
    rush: false,
    estimate: Money.fromCents(4000),
    estimateIsMinimum: false,
    deposit: Money.fromCents(2000),
    depositPayment: null,
    collection: fulfillment.method === "PICKUP" ? FIRST : null,
    submissionKey: null,
    submissionFingerprint: null,
    bundleId: null,
    alertBody: "Jordan · Standard Clean · Mail-In",
    items: [{ brand: null, model: null, description: null, material: null, serviceIds: ["premium"], estimate: Money.fromCents(4000), photos: [] }],
  });
  return { orders, order, notifications, deps: { orders, notifications, now: () => FIXED_NOW } };
}

describe("rescheduleVisit", () => {
  it("moves the Appointment, not the Order's booked collection time, and emails the customer once", async () => {
    const { order, deps, notifications } = await seed();
    const appointmentId = order.appointments[0]!.id;

    const result = await rescheduleVisit(deps, ADMIN, { appointmentId, expectedStartsAt: FIRST.startsAt, date: "2026-10-04", slot: "9:00 AM – 9:30 AM" });

    const want = collectionTimes("2026-10-04", "9:00 AM – 9:30 AM");
    expect(result).toMatchObject({ changed: true, emailed: true });
    expect(order.appointments[0]).toMatchObject({ startsAt: want.startsAt, endsAt: want.endsAt, status: "SCHEDULED" });
    expect(order.fulfillment).toMatchObject({ date: "2026-10-03", slot: "4:30 PM – 5:00 PM" });
    expect(notifications.sent).toHaveLength(1);
    expect(notifications.sent[0]!.to).toBe("c@example.com");
    expect(notifications.sent[0]!.body).toContain("Sunday, October 4, 9:00 AM – 9:30 AM");
    expect(notifications.sent[0]!.body).toContain("Saturday, October 3, 4:30 PM – 5:00 PM");
    expect(notifications.sent[0]!.body).not.toMatch(/pickup/i);
  });

  it("is a no-op on replay: same input changes and sends nothing more", async () => {
    const { order, deps, notifications } = await seed();
    const input = { appointmentId: order.appointments[0]!.id, expectedStartsAt: FIRST.startsAt, date: "2026-10-04", slot: "9:00 AM – 9:30 AM" };
    await rescheduleVisit(deps, ADMIN, input);

    expect(await rescheduleVisit(deps, ADMIN, input)).toMatchObject({ changed: false, emailed: false });
    expect(notifications.sent).toHaveLength(1);
  });

  it("refuses a visit someone else moved meanwhile", async () => {
    const { order, deps } = await seed();
    const appointmentId = order.appointments[0]!.id;
    await rescheduleVisit(deps, ADMIN, { appointmentId, expectedStartsAt: FIRST.startsAt, date: "2026-10-04", slot: "9:00 AM – 9:30 AM" });
    await expect(rescheduleVisit(deps, ADMIN, { appointmentId, expectedStartsAt: FIRST.startsAt, date: "2026-10-05", slot: "9:00 AM – 9:30 AM" })).rejects.toThrow(AppointmentMovedError);
  });

  it("refuses a COMPLETED or CANCELLED visit and sends nothing", async () => {
    for (const status of ["COMPLETED", "CANCELLED"] as const) {
      const { order, deps, notifications } = await seed();
      order.appointments[0]!.status = status;
      await expect(
        rescheduleVisit(deps, ADMIN, { appointmentId: order.appointments[0]!.id, expectedStartsAt: FIRST.startsAt, date: "2026-10-04", slot: "9:00 AM – 9:30 AM" }),
      ).rejects.toThrow(AppointmentNotScheduledError);
      expect(order.appointments[0]!.startsAt).toEqual(FIRST.startsAt);
      expect(notifications.sent).toHaveLength(0);
    }
  });

  it("refuses an unknown visit, a non-slot, a past slot and the same time", async () => {
    const { order, deps } = await seed();
    const appointmentId = order.appointments[0]!.id;
    const base = { appointmentId, expectedStartsAt: FIRST.startsAt, date: "2026-10-04", slot: "9:00 AM – 9:30 AM" };
    await expect(rescheduleVisit(deps, ADMIN, { ...base, appointmentId: "missing" })).rejects.toThrow(AppointmentNotFoundError);
    await expect(rescheduleVisit(deps, ADMIN, { ...base, slot: "9:10 AM – 9:40 AM" })).rejects.toThrow(VisitSlotError);
    await expect(rescheduleVisit(deps, ADMIN, { ...base, date: "2026-02-30" })).rejects.toThrow(VisitSlotError);
    await expect(rescheduleVisit(deps, ADMIN, { ...base, date: "2026-09-30" })).rejects.toThrow(VisitSlotError);
    await expect(rescheduleVisit(deps, ADMIN, { ...base, date: "2026-10-03", slot: "4:30 PM – 5:00 PM" })).rejects.toThrow(VisitSlotError);
  });

  it("lets the owner take a slot the customer lead time would refuse, but not one that has started", async () => {
    const { order, deps } = await seed();
    const appointmentId = order.appointments[0]!.id;
    // Now is 11:00 AM on Oct 1: 12:00 PM is inside the customers' 2-hour lead time, 10:30 AM has begun.
    await expect(rescheduleVisit(deps, ADMIN, { appointmentId, expectedStartsAt: FIRST.startsAt, date: "2026-10-01", slot: "10:30 AM – 11:00 AM" })).rejects.toThrow(VisitSlotError);
    await expect(rescheduleVisit(deps, ADMIN, { appointmentId, expectedStartsAt: FIRST.startsAt, date: "2026-10-01", slot: "12:00 PM – 12:30 PM" })).resolves.toMatchObject({ changed: true });
  });

  it("keeps the move when the email fails, and says so", async () => {
    const { order, deps, notifications } = await seed();
    notifications.failing = true;
    const result = await rescheduleVisit(deps, ADMIN, { appointmentId: order.appointments[0]!.id, expectedStartsAt: FIRST.startsAt, date: "2026-10-04", slot: "9:00 AM – 9:30 AM" });
    expect(result).toMatchObject({ changed: true, emailed: false });
    expect(order.appointments[0]!.startsAt).not.toEqual(FIRST.startsAt);
  });

  it("is admin-only", async () => {
    const { order, deps } = await seed();
    await expect(
      rescheduleVisit(deps, CUSTOMER, { appointmentId: order.appointments[0]!.id, expectedStartsAt: FIRST.startsAt, date: "2026-10-04", slot: "9:00 AM – 9:30 AM" }),
    ).rejects.toThrow(UnauthorizedError);
  });
});

describe("bookReturnVisit", () => {
  const input = (orderId: string) => ({ orderId, date: "2026-10-08", slot: "10:00 AM – 10:30 AM" });

  it("creates a SCHEDULED RETURN and emails the customer", async () => {
    const { order, deps, notifications } = await seed();
    order.items[0]!.status = "READY_FOR_PICKUP_SHIPPING";

    const result = await bookReturnVisit(deps, ADMIN, input(order.id));

    const want = collectionTimes("2026-10-08", "10:00 AM – 10:30 AM");
    expect(result).toMatchObject({ created: true, emailed: true });
    expect(order.appointments.find((a) => a.kind === "RETURN")).toMatchObject({ status: "SCHEDULED", startsAt: want.startsAt, endsAt: want.endsAt });
    expect(notifications.sent).toHaveLength(1);
    expect(notifications.sent[0]!.body).toContain("Thursday, October 8, 10:00 AM – 10:30 AM");
    expect(notifications.sent[0]!.subject).not.toMatch(/READY_FOR|pickup/i);
  });

  it("is a no-op on replay, and refuses a different time once booked", async () => {
    const { order, deps, notifications } = await seed();
    order.items[0]!.status = "READY_FOR_PICKUP_SHIPPING";
    await bookReturnVisit(deps, ADMIN, input(order.id));

    expect(await bookReturnVisit(deps, ADMIN, input(order.id))).toMatchObject({ created: false, emailed: false });
    expect(order.appointments.filter((a) => a.kind === "RETURN")).toHaveLength(1);
    expect(notifications.sent).toHaveLength(1);
    await expect(bookReturnVisit(deps, ADMIN, { ...input(order.id), date: "2026-10-09" })).rejects.toThrow(ReturnAlreadyBookedError);
  });

  it("reuses a CANCELLED Return instead of adding a second", async () => {
    const { order, deps } = await seed();
    order.items[0]!.status = "READY_FOR_PICKUP_SHIPPING";
    order.appointments.push({ id: "old", kind: "RETURN", status: "CANCELLED", startsAt: FIRST.startsAt, endsAt: FIRST.endsAt, notes: "old" });

    const result = await bookReturnVisit(deps, ADMIN, input(order.id));

    expect(result.created).toBe(true);
    expect(order.appointments.filter((a) => a.kind === "RETURN")).toHaveLength(1);
    expect(order.appointments.find((a) => a.kind === "RETURN")).toMatchObject({ id: "old", status: "SCHEDULED", notes: null });
  });

  it("offers no Return for Mail-In, or before a pair is ready", async () => {
    const mailIn = await seed({ method: "MAIL_IN", address: { line1: "1 A St", line2: null, city: "Austin", state: "TX", zip: "73301" }, preferredDate: null });
    mailIn.order.items[0]!.status = "READY_FOR_PICKUP_SHIPPING";
    await expect(bookReturnVisit(mailIn.deps, ADMIN, input(mailIn.order.id))).rejects.toThrow(ReturnNotAvailableError);

    const notReady = await seed();
    await expect(bookReturnVisit(notReady.deps, ADMIN, input(notReady.order.id))).rejects.toThrow(ReturnNotAvailableError);
    expect(notReady.notifications.sent).toHaveLength(0);
  });

  it("refuses an unknown Order and a bad slot, and is admin-only", async () => {
    const { order, deps } = await seed();
    order.items[0]!.status = "READY_FOR_PICKUP_SHIPPING";
    await expect(bookReturnVisit(deps, ADMIN, input("missing"))).rejects.toThrow(OrderNotFoundError);
    await expect(bookReturnVisit(deps, ADMIN, { ...input(order.id), slot: "nope" })).rejects.toThrow(VisitSlotError);
    await expect(bookReturnVisit(deps, CUSTOMER, input(order.id))).rejects.toThrow(UnauthorizedError);
    expect(order.appointments.some((a) => a.kind === "RETURN")).toBe(false);
  });

  it("keeps the booking when the email fails", async () => {
    const { order, deps, notifications } = await seed();
    order.items[0]!.status = "READY_FOR_PICKUP_SHIPPING";
    notifications.failing = true;
    expect(await bookReturnVisit(deps, ADMIN, input(order.id))).toMatchObject({ created: true, emailed: false });
  });
});
