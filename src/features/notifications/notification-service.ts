// The third-party seam for notifications (ADR-0003/0006). Phase 1
// deliberately uses a direct synchronous call through this interface — no
// outbox/worker yet. Promote to the DB-backed outbox (ADR-0006) once a
// second notification-triggering use-case makes the reliability problem
// real (see docs/SPEC.md Build sequence, Phase 3).

export interface NotificationService {
  sendEmail(params: { to: string; subject: string; body: string }): Promise<void>;
}

/** Phase 1 default: logs instead of calling Resend, so the slice runs with
 * zero external dependencies until the Resend adapter (ADR-0006) is wired. */
export class ConsoleNotificationService implements NotificationService {
  async sendEmail(params: { to: string; subject: string; body: string }): Promise<void> {
    // eslint-disable-next-line no-console
    console.log(`[notification] to=${params.to} subject="${params.subject}"`);
  }
}
