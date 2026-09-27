// The third-party seam for notifications (ADR-0003/0006). Phase 1
// deliberately uses a direct synchronous call through this interface — no
// outbox/worker yet. Promote to the DB-backed outbox (ADR-0006) once a
// second notification-triggering use-case makes the reliability problem
// real (see docs/SPEC.md Build sequence, Phase 3).

export interface NotificationService {
  sendEmail(params: { to: string; subject: string; body: string }): Promise<void>;
}

/** Used when Resend isn't configured (see ./index.ts): logs instead of
 * sending, so development needs no email account. Sign-in codes are in the
 * subject, so it's logged only when `logSubjects` is on (development); in
 * production only the recipient is, keeping codes out of hosting logs. */
export class ConsoleNotificationService implements NotificationService {
  constructor(private readonly options: { logSubjects: boolean } = { logSubjects: true }) {}

  async sendEmail(params: { to: string; subject: string; body: string }): Promise<void> {
    const subject = this.options.logSubjects ? ` subject="${params.subject}"` : " (subject withheld)";
    console.log(`[notification] to=${params.to}${subject}`);
  }
}
