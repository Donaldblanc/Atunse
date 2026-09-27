// Customer Account lookups for the booking and sign-in use-cases
// (ADR-0003/0011: use-cases depend on this interface, never on Prisma).
// Only Customer Accounts are ever returned: Admin Accounts are a separate
// identity (ADR-0014), even when they share an email with a customer.

export interface CustomerAccount {
  id: string;
  email: string;
}

export interface AccountRepository {
  /** `email` is matched case-insensitively (emails are stored lowercased). */
  findCustomerByEmail(email: string): Promise<CustomerAccount | null>;
  findCustomerById(accountId: string): Promise<CustomerAccount | null>;
}
