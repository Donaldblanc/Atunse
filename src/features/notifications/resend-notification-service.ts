import type { NotificationService } from "./notification-service";

// Resend adapter (ADR-0006). Calls the REST API directly: one endpoint,
// no SDK needed. Throws on any non-2xx so callers (e.g. submitOrder's
// send-until-success confirmation) can retry.
export class ResendNotificationService implements NotificationService {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async sendEmail(params: { to: string; subject: string; body: string }): Promise<void> {
    const res = await this.fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: this.from, to: [params.to], subject: params.subject, text: params.body }),
    });
    if (!res.ok) {
      throw new Error(`Resend rejected the email (${res.status}): ${(await res.text()).slice(0, 200)}`);
    }
  }
}
