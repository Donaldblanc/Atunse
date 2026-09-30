// Test double for the OrderRepository seam — lets use-case unit tests
// (ADR-0012's vertical slice) run with no real Postgres, per the build
// strategy's split between fast unit tests and real-DB integration tests.
// New Customer Accounts go into the shared InMemoryAccounts table, the
// same one the sign-in use-cases read, so tests can book → sign in → rebook.

import { InMemoryAccounts, InMemoryEmailTakenError } from "@/features/accounts/repositories/in-memory-repositories";
import { Money } from "@/shared/money/money";
import { liveEstimate, livePairs, type Appointment, type AuditEntry, type Item, type ItemStatus, type Order, type PaymentMethod } from "../domain";
import { BUNDLE_CATALOG } from "../service-catalog";
import {
  BundleNotFoundError,
  EmailTakenError,
  ItemNotFoundError,
  ItemStatusChangedError,
  PhotoKeyInUseError,
  AppointmentCancelledError,
  AppointmentNotFoundError,
  type AppointmentWithOrder,
  type AwaitingDeposits,
  type BookedOrder,
  type NewOrderInput,
  type OrderNote,
  type OrderRepository,
  type ScheduledAppointment,
  type StatusChange,
} from "./order-repository";

let nextId = 0;
function fakeId(prefix: string): string {
  nextId += 1;
  return `${prefix}_${nextId}`;
}

export class InMemoryOrderRepository implements OrderRepository {
  readonly orders = new Map<string, Order>();
  readonly appliedIdempotencyKeys = new Set<string>(); // `${itemId}:${key}`
  readonly auditEntries: (AuditEntry & { itemId: string; at?: Date })[] = [];
  /** Notes about Orders; nothing writes them yet, so tests seed this directly. */
  readonly notes: (OrderNote & { orderId: string })[] = [];
  private lastNumber = 1000;
  private readonly orderIdsBySubmissionKey = new Map<string, string>();
  private readonly uploadKeysInUse = new Set<string>();

  constructor(readonly accounts: InMemoryAccounts = new InMemoryAccounts()) {}

  async create(input: NewOrderInput): Promise<{ order: Order; created: boolean }> {
    if (input.submissionKey) {
      const existing = await this.findBySubmissionKey(input.submissionKey);
      if (existing) return { order: existing, created: false };
    }

    // Mirror the database's unique indexes, checking before writing
    // anything, like the single Prisma transaction.
    const uploadKeys = input.items.flatMap((item) => item.photos.map((photo) => photo.uploadKey));
    if (new Set(uploadKeys).size !== uploadKeys.length || uploadKeys.some((key) => this.uploadKeysInUse.has(key))) {
      throw new PhotoKeyInUseError();
    }
    // The bundles table is seeded from BUNDLE_CATALOG; its foreign key refuses any other id.
    if (input.bundleId && !BUNDLE_CATALOG.some((bundle) => bundle.id === input.bundleId)) {
      throw new BundleNotFoundError(input.bundleId);
    }

    let accountId: string;
    if ("accountId" in input.owner) {
      accountId = input.owner.accountId;
    } else {
      try {
        accountId = this.accounts.add({ role: "CUSTOMER", ...input.owner.newCustomer }).id;
      } catch (err) {
        if (err instanceof InMemoryEmailTakenError) throw new EmailTakenError();
        throw err;
      }
    }

    const orderId = fakeId("order");
    this.lastNumber += 1;
    const order: Order = {
      id: orderId,
      number: this.lastNumber,
      accountId,
      contactName: input.contactName,
      contactEmail: input.contactEmail,
      contactPhone: input.contactPhone,
      createdAt: new Date(),
      policyAcceptedAt: input.policyAcceptedAt,
      termsAcceptance: { ...input.terms, acknowledgments: { ...input.terms.acknowledgments }, acceptedAt: input.policyAcceptedAt },
      fulfillment: input.fulfillment,
      rush: input.rush,
      estimate: input.estimate,
      estimateIsMinimum: input.estimateIsMinimum,
      deposit: input.deposit,
      dropOffFee: Money.zero(),
      tax: Money.zero(),
      confirmationEmailSentAt: null,
      submissionFingerprint: input.submissionFingerprint,
      bundleId: input.bundleId,
      items: input.items.map((item) => ({
        id: fakeId("item"),
        orderId,
        brand: item.brand,
        model: item.model,
        description: item.description,
        material: item.material,
        size: null,
        colorway: null,
        serviceIds: item.serviceIds,
        estimate: item.estimate,
        status: "REQUEST_SUBMITTED",
        price: null,
        photoKeys: item.photos.map((photo) => photo.key),
      })),
      payments: input.depositPayment
        ? [
            {
              id: fakeId("payment"),
              kind: "DEPOSIT",
              method: input.depositPayment.method,
              amount: input.depositPayment.amount,
              status: "PENDING",
              receivedAt: null,
              createdAt: new Date(),
            },
          ]
        : [],
      appointments: input.collection ? [{ id: fakeId("appointment"), kind: "COLLECTION", status: "SCHEDULED", notes: null, ...input.collection }] : [],
    };
    for (const key of uploadKeys) this.uploadKeysInUse.add(key);
    this.orders.set(order.id, order);
    if (input.submissionKey) this.orderIdsBySubmissionKey.set(input.submissionKey, order.id);
    return { order, created: true };
  }

  async findById(orderId: string): Promise<Order | null> {
    return this.orders.get(orderId) ?? null;
  }

  async findBySubmissionKey(submissionKey: string): Promise<Order | null> {
    const orderId = this.orderIdsBySubmissionKey.get(submissionKey);
    return orderId ? (this.orders.get(orderId) ?? null) : null;
  }

  async markConfirmationEmailSent(orderId: string, sentAt: Date): Promise<void> {
    const order = this.orders.get(orderId);
    if (order) order.confirmationEmailSentAt = sentAt;
  }

  async transitionItemStatus(params: {
    itemId: string;
    toStatus: Item["status"];
    entry: AuditEntry;
    receivesDeposit?: boolean;
  }): Promise<Item | null> {
    const key = params.entry.idempotencyKey ? `${params.itemId}:${params.entry.idempotencyKey}` : null;
    if (key && this.appliedIdempotencyKeys.has(key)) return null;

    const item = [...this.orders.values()].flatMap((o) => o.items).find((i) => i.id === params.itemId);
    if (!item) throw new ItemNotFoundError(params.itemId);
    if (params.entry.fromStatus && item.status !== params.entry.fromStatus) throw new ItemStatusChangedError(item.status);

    item.status = params.toStatus;
    if (key) this.appliedIdempotencyKeys.add(key);
    this.auditEntries.push({ ...params.entry, itemId: params.itemId, at: new Date() });
    if (params.receivesDeposit) {
      const deposit = this.orders.get(item.orderId)?.payments.find((p) => p.kind === "DEPOSIT" && p.status === "PENDING");
      if (deposit) Object.assign(deposit, { status: "RECEIVED", receivedAt: new Date() });
    }
    return item;
  }

  async listBookedBetween(from: Date, to: Date): Promise<BookedOrder[]> {
    return [...this.orders.values()]
      .filter((order) => order.createdAt >= from && order.createdAt < to)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async summarizeBookedBetween(from: Date, to: Date): Promise<{ orders: number; value: Money }> {
    const live = (await this.listBookedBetween(from, to)).filter((order) => livePairs(order).length > 0);
    return { orders: live.length, value: live.reduce((sum, order) => sum.add(liveEstimate(order)), Money.zero()) };
  }

  async listRecent(limit: number): Promise<Order[]> {
    return [...this.orders.values()].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, limit);
  }

  async listAppointmentsBetween(from: Date, to: Date): Promise<ScheduledAppointment[]> {
    return [...this.orders.values()]
      .flatMap((order) =>
        order.appointments
          .filter((appointment) => appointment.status === "SCHEDULED" && appointment.startsAt >= from && appointment.startsAt < to)
          .map((appointment) => ({
            ...appointment,
            order: { id: order.id, number: order.number, contactName: order.contactName, itemStatuses: order.items.map((item) => item.status) },
          })),
      )
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  }

  async countItemsByStatus(): Promise<Partial<Record<ItemStatus, number>>> {
    const counts: Partial<Record<ItemStatus, number>> = {};
    for (const item of [...this.orders.values()].flatMap((order) => order.items)) {
      counts[item.status] = (counts[item.status] ?? 0) + 1;
    }
    return counts;
  }

  async summarizeAwaitingDeposit(): Promise<AwaitingDeposits> {
    const pending = [...this.orders.values()]
      .filter((order) => order.items.some((item) => item.status !== "CANCELLED"))
      .flatMap((order) => order.payments)
      .filter((payment) => payment.kind === "DEPOSIT" && payment.status === "PENDING");
    const byMethod: Record<PaymentMethod, number> = { ZELLE: 0, CASH: 0, CARD: 0, APPLE_PAY: 0 };
    for (const payment of pending) byMethod[payment.method] += 1;
    return {
      orders: pending.length,
      deposits: pending.reduce((sum, payment) => sum.add(payment.amount), Money.zero()),
      byMethod,
    };
  }

  async listOrderNotes(orderId: string): Promise<OrderNote[]> {
    return this.notes
      .filter((note) => note.orderId === orderId)
      .map(({ id, body, createdAt }) => ({ id, body, createdAt }))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async listStatusChanges(orderId: string): Promise<StatusChange[]> {
    const itemIds = new Set(this.orders.get(orderId)?.items.map((item) => item.id));
    return this.auditEntries
      .filter((entry) => itemIds.has(entry.itemId) && entry.toStatus !== null)
      .map((entry) => ({ itemId: entry.itemId, toStatus: entry.toStatus!, at: entry.at ?? new Date(0) }))
      .sort((a, b) => a.at.getTime() - b.at.getTime());
  }

  async findAppointment(appointmentId: string): Promise<AppointmentWithOrder | null> {
    for (const order of this.orders.values()) {
      const appointment = order.appointments.find((candidate) => candidate.id === appointmentId);
      if (appointment) return { appointment, order };
    }
    return null;
  }

  async completeAppointment(appointmentId: string): Promise<Appointment> {
    const found = await this.findAppointment(appointmentId);
    if (!found) throw new AppointmentNotFoundError(appointmentId);
    if (found.appointment.status === "CANCELLED") throw new AppointmentCancelledError();
    found.appointment.status = "COMPLETED";
    return found.appointment;
  }
}
