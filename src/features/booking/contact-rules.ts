// Contact checks shared by the booking UI (contact-step.tsx) and the
// server's submitOrder validation, so the form never lets through what the
// server will reject. Pure: no React.

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email.trim());
}

/** 10 digits, or 11 starting with the US country code 1. Formatting is ignored. */
export function isValidUsPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, "");
  return digits.length === 10 || (digits.length === 11 && digits.startsWith("1"));
}

/** 5-digit zip, optionally ZIP+4. */
export function isValidZip(zip: string): boolean {
  return /^\d{5}(-\d{4})?$/.test(zip.trim());
}
