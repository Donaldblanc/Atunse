// Customer Account lookups for the booking and sign-in use-cases
// (ADR-0003/0011: use-cases depend on this interface, never on Prisma).
// Only Customer Accounts are ever returned: Admin Accounts are a separate
// identity (ADR-0014), even when they share an email with a customer.

export interface CustomerAccount {
  id: string;
  email: string;
}

/**
 * One row of the Customers list: the Account's contact details. Its order
 * count comes from OrderRepository.countByAccountId (the use-case's job to
 * combine), so this repository stays Account-only.
 */
export interface CustomerListRow {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  createdAt: Date;
}

/** A Customer Account's contact details (Customers detail screen). */
export interface CustomerDetail {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  createdAt: Date;
}

/** Settings' Account Settings panel: the signed-in admin's own Account (ADR-0014). */
export interface AdminAccount {
  id: string;
  name: string | null;
  email: string;
  passwordHash: string | null;
  sessionVersion: number;
}

/** Thrown by updateAdminProfile when another Admin Account already uses the email. */
export class AdminEmailTakenError extends Error {
  constructor() {
    super("Another admin uses that email");
    this.name = "AdminEmailTakenError";
  }
}

export interface AccountRepository {
  /** `email` is matched case-insensitively (emails are stored lowercased). */
  findCustomerByEmail(email: string): Promise<CustomerAccount | null>;
  findCustomerById(accountId: string): Promise<CustomerAccount | null>;

  /** Every Customer Account (Customers list), most recently created first, up to `limit` starting at `offset`. */
  listCustomers(params?: { limit?: number; offset?: number }): Promise<CustomerListRow[]>;

  /** A Customer Account's contact details, or null for an id no Customer Account has. */
  findCustomerDetail(accountId: string): Promise<CustomerDetail | null>;

  /** An Admin Account by id, or null for an id no Admin Account has. */
  findAdminById(accountId: string): Promise<AdminAccount | null>;
  /**
   * Settings' Account Settings "Save": the admin's own name and email. Throws
   * AdminEmailTakenError if another admin has the email. Changing the email
   * bumps sessionVersion, which signs out every existing admin session.
   */
  updateAdminProfile(accountId: string, fields: { name: string | null; email: string }): Promise<void>;
  /** Settings' Account Settings "Change Password": replaces the stored hash and bumps sessionVersion (signs out every existing admin session). */
  updateAdminPasswordHash(accountId: string, passwordHash: string): Promise<void>;
  /** The admin's current sessionVersion, or null for an id no Admin Account has. */
  findAdminSessionVersion(accountId: string): Promise<number | null>;
  /** Revokes every admin session cookie issued so far (sign-out). */
  bumpAdminSessionVersion(accountId: string): Promise<void>;
}
