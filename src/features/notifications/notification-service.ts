// The third-party seam for notifications (ADR-0003/0006). Phase 1
// deliberately uses a direct synchronous call through this interface — no
// outbox/worker yet. Promote to the DB-backed outbox (ADR-0006) once a
// second notification-triggering use-case makes the reliability problem
// real (see docs/SPEC.md Build sequence, Phase 3).

export interface NotificationService {
  sendEmail(params: { to: string; subject: string; body: string }): Promise<void>;
}

/** Used when Resend isn't configured (see ./index.ts): logs the recipient
 * and subject instead of sending, so development needs no email account.
 * Sign-in codes are in the subject, so they show up in the dev log. */
export class ConsoleNotificationService implements NotificationService {
  async sendEmail(params: { to: string; subject: string; body: string }): Promise<void> {
    // eslint-disable-next-line no-console
    console.log(`[notification] to=${params.to} subject="${params.subject}"`);
  }
}
