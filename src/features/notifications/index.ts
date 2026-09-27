import { ConsoleNotificationService, type NotificationService } from "./notification-service";
import { ResendNotificationService } from "./resend-notification-service";

export type { NotificationService } from "./notification-service";

/**
 * Resend when RESEND_API_KEY and EMAIL_FROM are set, otherwise the console
 * logger. In development the console is the point: sign-in codes show up in
 * the dev server log. In production it means no customer receives email,
 * so it warns loudly.
 */
export function notificationServiceFromEnv(env: NodeJS.ProcessEnv = process.env): NotificationService {
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.EMAIL_FROM?.trim();
  if (apiKey && from) return new ResendNotificationService(apiKey, from);
  if (env.NODE_ENV === "production") {
    console.warn("[notifications] RESEND_API_KEY/EMAIL_FROM not set; emails are only logged, not sent");
  }
  return new ConsoleNotificationService();
}
