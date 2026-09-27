// How a customer pays the Deposit by Zelle (ADR-0002: confirmed manually by
// the owner in admin). Read from env so the handle isn't hard-coded in
// source; when unset, the confirmation says instructions will follow by
// email instead of showing a blank recipient.

export interface PaymentInstructions {
  zelle: { recipient: string; name: string } | null;
}

export function paymentInstructionsFromEnv(env: NodeJS.ProcessEnv = process.env): PaymentInstructions {
  const recipient = env.ZELLE_RECIPIENT?.trim();
  const name = env.ZELLE_NAME?.trim();
  return { zelle: recipient && name ? { recipient, name } : null };
}
