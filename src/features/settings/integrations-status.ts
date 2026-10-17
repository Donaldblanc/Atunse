// Business Profile's Integrations panel: read-only Connected/Not Connected
// status, sourced from which env vars are set. No Prisma, no write path —
// feature toggles stay env-var/config-only (SPEC.md).

export interface IntegrationsStatus {
  stripe: boolean;
  email: boolean;
  sms: boolean;
}

export function getIntegrationsStatus(): IntegrationsStatus {
  return {
    stripe: process.env.FEATURE_STRIPE_ENABLED === "true",
    // Resend (ADR-0006) is only used once both are set; otherwise emails are only logged.
    email: Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM),
    sms: process.env.FEATURE_SMS_ENABLED === "true",
  };
}
