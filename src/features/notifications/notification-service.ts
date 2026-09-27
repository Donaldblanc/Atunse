// The third-party seam for notifications (ADR-0003/0006). Phase 1
// deliberately uses a direct synchronous call through this interface — no
// outbox/worker yet. Promote to the DB-backed outbox (ADR-0006) once a
// second notification-triggering use-case makes the reliability problem
// real (see docs/SPEC.md Build sequence, Phase 3).

export interface NotificationService {
  sendEmail(params: { to: string; subject: string; body: string }): Promise<void>;
}

/** Used when Resend isn't configured (see ./index.ts): logs instead of
 * sending, so development needs no email account. In development it logs
 * the recipient and subject (sign-in codes are in the subject); in
 * production only a masked recipient, keeping codes and customer emails
 * out of hosting logs. */
export class ConsoleNotificationService implements NotificationService {
  constructor(private readonly options: { development: boolean } = { development: true }) {}

  async sendEmail(params: { to: string; subject: string; body: string }): Promise<void> {
    // In production, logs are no place for customer details: mask the
    // recipient and withhold the subject (it can carry a sign-in code).
    const to = this.options.development ? params.to : maskEmail(params.to);
    const subject = this.options.development ? ` subject="${params.subject}"` : " (subject withheld)";
    console.log(`[notification] to=${to}${subject}`);
  }
}

/** "jordan@example.com" becomes "j***@example.com". */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at <= 0) return "***";
  return `${email[0]}***${email.slice(at)}`;
}
