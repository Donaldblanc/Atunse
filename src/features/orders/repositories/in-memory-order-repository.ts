// Test double for the OrderRepository seam — lets use-case unit tests
// (ADR-0012's vertical slice) run with no real Postgres, per the build
// strategy's split between fast unit tests and real-DB integration tests.
// New Customer Accounts go into the shared InMemoryAccounts table, the
// same one the sign-in use-cases read, so tests can book → sign in → rebook.

import { InMemoryAccounts, InMemoryEmailTakenError } from "@/features/accounts/repositories/in-memory-repositories";
import { Money } from "@/shared/money/money";
import { liveEstimate, livePairs, MANUAL_PAYMENT_CONFIRMED, type Appointment, type AuditEntry, type Item, type ItemStatus, type Order, type Payment, type PaymentMethod } from "../domain";
import { DETAILS_EDITED, diffOrderDetails, isNoop, ORDER_CONTACT_EDITED, type OrderDetailsInput } from "../order-details";
import { BUNDLE_CATALOG } from "../service-catalog";
import {
  BundleNotFoundError,
  EmailTakenError,
  ItemNotFoundError,
  ItemStatusChangedError,
  NoPendingDepositError,
  OrderChangedError,
  OrderNotFoundError,
  PhotoKeyInUseError,
  AppointmentCancelledError,
  AppointmentNotFoundError,
  type AppointmentWithOrder,
  type AwaitingDepositOrder,
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
      updatedAt: new Date(),
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
        condition: null,
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
    price?: Money;
  }): Promise<Item | null> {
    const key = params.entry.idempotencyKey ? `${params.itemId}:${params.entry.idempotencyKey}` : null;
    if (key && this.appliedIdempotencyKeys.has(key)) return null;

    const item = [...this.orders.values()].flatMap((o) => o.items).find((i) => i.id === params.itemId);
    if (!item) throw new ItemNotFoundError(params.itemId);
    if (params.entry.fromStatus && item.status !== params.entry.fromStatus) throw new ItemStatusChangedError(item.status);

    item.status = params.toStatus;
    if (params.price) item.price = params.price;
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

  /** The Orders whose Deposit is PENDING and that still have a live pair: the one rule behind the summary, the list and confirmDeposit. */
  private awaitingDeposits(): { order: Order; payment: Payment }[] {
    return [...this.orders.values()]
      .filter((order) => livePairs(order).length > 0)
      .flatMap((order) => order.payments.filter((payment) => payment.kind === "DEPOSIT" && payment.status === "PENDING").map((payment) => ({ order, payment })));
  }

  async summarizeAwaitingDeposit(): Promise<AwaitingDeposits> {
    const pending = this.awaitingDeposits().map(({ payment }) => payment);
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
      .filter((entry) => itemIds.has(entry.itemId) && entry.toStatus !== null && entry.toStatus !== entry.fromStatus)
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

  async listAwaitingDeposit(): Promise<AwaitingDepositOrder[]> {
    return this.awaitingDeposits()
      .map(({ order, payment }) => ({
        orderId: order.id,
        number: order.number,
        contactName: order.contactName,
        createdAt: order.createdAt,
        deposit: { method: payment.method, amount: payment.amount },
      }))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async listWithItemsIn(statuses: ItemStatus[]): Promise<Order[]> {
    return [...this.orders.values()]
      .filter((order) => order.items.some((item) => statuses.includes(item.status)))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async confirmDeposit(params: { orderId: string; actorAccountId: string | null; idempotencyKey: string }): Promise<boolean> {
    const order = this.orders.get(params.orderId);
    const keyOf = (itemId: string) => `${itemId}:${params.idempotencyKey}`;
    if (order?.items.some((item) => this.appliedIdempotencyKeys.has(keyOf(item.id)))) return false;

    const awaiting = this.awaitingDeposits().find((entry) => entry.order.id === params.orderId);
    if (!order || !awaiting) throw new NoPendingDepositError(params.orderId);

    Object.assign(awaiting.payment, { status: "RECEIVED", receivedAt: new Date() });
    for (const item of livePairs(order)) {
      this.appliedIdempotencyKeys.add(keyOf(item.id));
      this.auditEntries.push({
        action: MANUAL_PAYMENT_CONFIRMED,
        fromStatus: item.status,
        toStatus: item.status,
        actorAccountId: params.actorAccountId,
        idempotencyKey: params.idempotencyKey,
        itemId: item.id,
      });
    }
    return true;
  }

  async updateOrderDetails(params: {
    orderId: string;
    expectedUpdatedAt: Date;
    details: OrderDetailsInput;
    actorAccountId: string | null;
    idempotencyKey: string;
  }): Promise<"updated" | "unchanged" | "already-applied"> {
    const order = this.orders.get(params.orderId);
    if (!order) throw new OrderNotFoundError(params.orderId);
    const keys = [params.idempotencyKey, `${params.idempotencyKey}:contact`];
    if (order.items.some((item) => keys.some((key) => this.appliedIdempotencyKeys.has(`${item.id}:${key}`)))) return "already-applied";
    if (order.updatedAt.getTime() !== params.expectedUpdatedAt.getTime()) throw new OrderChangedError();
    const stranger = params.details.pairs.find((pair) => !order.items.some((item) => item.id === pair.itemId));
    if (stranger) throw new ItemNotFoundError(stranger.itemId);

    const diff = diffOrderDetails(order, params.details);
    if (isNoop(diff)) return "unchanged";

    const { contact, address, pairs } = params.details;
    order.contactName = contact.name;
    order.contactEmail = contact.email;
    order.contactPhone = contact.phone;
    order.fulfillment = { ...order.fulfillment, address: { ...address } };
    // A later edit must see a later stamp even inside the same millisecond.
    order.updatedAt = new Date(Math.max(Date.now(), order.updatedAt.getTime() + 1));
    for (const { itemId, ...fields } of pairs) Object.assign(order.items.find((item) => item.id === itemId)!, fields);

    const record = (itemId: string, action: string, key: string, metadata: Record<string, unknown>) => {
      this.appliedIdempotencyKeys.add(`${itemId}:${key}`);
      this.auditEntries.push({ itemId, action, fromStatus: null, toStatus: null, actorAccountId: params.actorAccountId, idempotencyKey: key, metadata, at: new Date() });
    };
    for (const change of diff.pairs) record(change.itemId, DETAILS_EDITED, params.idempotencyKey, { changes: change.changes });
    if (diff.contact.length > 0) record(order.items[0]!.id, ORDER_CONTACT_EDITED, `${params.idempotencyKey}:contact`, { fields: diff.contact });
    return "updated";
  }

  async addOrderNote(params: { orderId: string; authorAccountId: string | null; body: string }): Promise<OrderNote> {
    if (!this.orders.has(params.orderId)) throw new OrderNotFoundError(params.orderId);
    const note = { id: fakeId("note"), orderId: params.orderId, body: params.body, createdAt: new Date() };
    this.notes.push(note);
    return { id: note.id, body: note.body, createdAt: note.createdAt };
  }

  async findByItemId(itemId: string): Promise<Order | null> {
    return [...this.orders.values()].find((order) => order.items.some((item) => item.id === itemId)) ?? null;
  }
}
