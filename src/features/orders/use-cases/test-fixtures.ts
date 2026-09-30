// Shared fixtures for use-case unit tests: a booking that passes every
// submitOrder rule, and in-memory deps pinned to a fixed "now".

import type { EmailMessage, NotificationService } from "@/features/notifications/notification-service";
import type { PaymentInstructions } from "../payment-instructions";
import { InMemoryAccounts } from "@/features/accounts/repositories/in-memory-repositories";
import { InMemoryFileStorage } from "@/shared/storage/in-memory-file-storage";
import { InMemoryOrderRepository } from "../repositories/in-memory-order-repository";
import type { PairInput, SubmitOrderDeps, SubmitOrderInput } from "./submit-order";
import { BOOKING_ACKNOWLEDGMENTS } from "../booking-terms";
import { TERMS_AGREEMENT } from "@/shared/legal-documents";

export const FIXED_NOW = new Date("2026-10-01T15:00:00Z"); // Oct 1, 11 AM in New York

export class RecordingNotificationService implements NotificationService {
  readonly sent: EmailMessage[] = [];
  /** Set to make the next sends throw, like a provider outage. */
  failing = false;
  async sendEmail(params: EmailMessage): Promise<void> {
    if (this.failing) throw new Error("email provider unavailable");
    this.sent.push(params);
  }
}

export function bookingDeps<O extends Partial<SubmitOrderDeps> = object>(overrides?: O) {
  // One accounts table shared by the order repository (which creates new
  // Customer Accounts) and submitOrder's lookups, like the real database.
  const accounts = new InMemoryAccounts();
  // Every photo key the fixtures use is "uploaded" as a real JPEG header.
  const storage = new InMemoryFileStorage();
  for (let i = 0; i < 12; i++) storage.put(`bookings/0b6e8c1e-3f7a-4c2d-9e1b-5a4f3c2d1e0f/${i}.jpg`);
  const base = {
    storage,
    accounts,
    orders: new InMemoryOrderRepository(accounts),
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
    acknowledgedTerms: BOOKING_ACKNOWLEDGMENTS.map((ack) => ack.id),
    termsVersion: TERMS_AGREEMENT.version,
    contact: { name: "Jordan Smith", email: "customer@example.com", phone: "(212) 555-0142" },
    fulfillment: {
      method: "PICKUP",
      address: { line1: "123 Main St", line2: null, city: "New York", state: "NY", zip: "10001" },
      date: "2026-10-03",
      slot: "4:30 PM – 5:00 PM",
    },
    rush: false,
    bundleId: null,
    items: [validPair()],
    ...overrides,
  };
}

/** One pair that passes every rule; `photo` picks one of the pre-uploaded photos. */
export function validPair(overrides: Partial<PairInput> = {}, photo = 0): PairInput {
  return {
    brand: "Nike Air Force 1",
    material: "Leather",
    notes: "scuffed toe box",
    serviceIds: ["standard"],
    photoKeys: [`bookings/0b6e8c1e-3f7a-4c2d-9e1b-5a4f3c2d1e0f/${photo}.jpg`],
    ...overrides,
  };
}

/** A valid three-pair Bundle booking: each pair has its own photo. */
export function validBundleInput(bundleId = "revival", overrides: Partial<SubmitOrderInput> = {}): SubmitOrderInput {
  return validBookingInput({
    bundleId,
    items: [0, 1, 2].map((photo) => validPair({ serviceIds: [] }, photo)),
    ...overrides,
  });
}
