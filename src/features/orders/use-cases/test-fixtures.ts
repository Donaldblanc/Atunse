// Shared fixtures for use-case unit tests: a booking that passes every
// submitOrder rule, and in-memory deps pinned to a fixed "now".

import type { NotificationService } from "@/features/notifications/notification-service";
import type { PaymentInstructions } from "../payment-instructions";
import { InMemoryOrderRepository } from "../repositories/in-memory-order-repository";
import type { SubmitOrderDeps, SubmitOrderInput } from "./submit-order";

export const FIXED_NOW = new Date("2026-10-01T15:00:00Z"); // Oct 1, 11 AM in New York

export class RecordingNotificationService implements NotificationService {
  readonly sent: { to: string; subject: string; body: string }[] = [];
  /** Set to make the next sends throw, like a provider outage. */
  failing = false;
  async sendEmail(params: { to: string; subject: string; body: string }): Promise<void> {
    if (this.failing) throw new Error("email provider unavailable");
    this.sent.push(params);
  }
}

export function bookingDeps<O extends Partial<SubmitOrderDeps> = object>(overrides?: O) {
  const base = {
    orders: new InMemoryOrderRepository(),
    notifications: new RecordingNotificationService(),
    paymentInstructions: { zelle: { recipient: "pay@restoredbydj.com", name: "RestoredByDJ" } } as PaymentInstructions,
    customerSignInEnabled: false, // the production default
    now: () => FIXED_NOW,
  };
  // Keep the concrete test doubles' types (e.g. `.sent`) unless overridden.
  return { ...base, ...overrides } as Omit<typeof base, keyof O> & O;
}

export function validBookingInput(overrides: Partial<SubmitOrderInput> = {}): SubmitOrderInput {
  return {
    submissionKey: null,
    policyAccepted: true,
    contact: { name: "Jordan Smith", email: "customer@example.com", phone: "(212) 555-0142" },
    fulfillment: {
      method: "PICKUP",
      address: { line1: "123 Main St", line2: null, city: "New York", state: "NY", zip: "10001" },
      date: "2026-10-03",
      slot: "4:30 PM – 5:00 PM",
    },
    rush: false,
    item: {
      brand: "Nike Air Force 1",
      material: "Leather",
      notes: "scuffed toe box",
      serviceIds: ["standard"],
      photoKeys: ["bookings/0b6e8c1e-3f7a-4c2d-9e1b-5a4f3c2d1e0f/0.jpg"],
    },
    ...overrides,
  };
}
