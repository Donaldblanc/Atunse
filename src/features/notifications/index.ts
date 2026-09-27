import { ConsoleNotificationService, type NotificationService } from "./notification-service";
import { ResendNotificationService } from "./resend-notification-service";

export type { NotificationService } from "./notification-service";

/** Whether emails can actually reach people (Resend is configured). */
export function emailDeliveryConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.RESEND_API_KEY?.trim() && env.EMAIL_FROM?.trim());
}

/**
 * Resend when RESEND_API_KEY and EMAIL_FROM are set, otherwise the console
 * logger. In development the console is the point: sign-in codes show up in
 * the dev server log. In production it means no customer receives email,
 * so it warns, and the console logger then masks recipients and omits
 * subjects (they can carry sign-in codes) in the hosting logs.
 */
export function notificationServiceFromEnv(env: NodeJS.ProcessEnv = process.env): NotificationService {
  if (emailDeliveryConfigured(env)) return new ResendNotificationService(env.RESEND_API_KEY!.trim(), env.EMAIL_FROM!.trim());
  const isProduction = env.NODE_ENV === "production";
  if (isProduction) {
    console.warn("[notifications] RESEND_API_KEY/EMAIL_FROM not set; emails are only logged, not sent");
  }
  return new ConsoleNotificationService({ development: !isProduction });
}
