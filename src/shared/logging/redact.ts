// One place for keeping customer data and secrets out of logs (vulnerability
// scan). Anything that logs something user-supplied goes through here.

/** "jordan@example.com" becomes "j***@example.com". */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at <= 0) return "***";
  return `${email[0]}***${email.slice(at)}`;
}

/**
 * Redacts things that must never reach a log line: email addresses (masked
 * as above), 6-digit sign-in codes, bearer tokens, and the signed-token and
 * presigned-URL query strings (a session cookie, an S3 signature).
 */
export function redactForLog(text: string): string {
  return text
    .replace(/[^\s"'<>@]+@[^\s"'<>@]+\.[a-z]{2,}/gi, (email) => maskEmail(email))
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/g, "Bearer [redacted]")
    .replace(/\b(X-Amz-Signature|X-Amz-Credential|signature|token)=[^&\s"']+/gi, "$1=[redacted]")
    .replace(/\b[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\b/g, "[redacted-token]")
    .replace(/\b\d{6}\b/g, "[code]");
}
