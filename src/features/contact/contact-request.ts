// Request shape for POST /api/v1/contact. Shape checks only; the rules live
// in validateContactMessage so they hold for every caller.

import { z } from "zod";
import type { ContactMessageInput } from "./contact-message";

const contactBody = z.object({
  firstName: z.string().max(200),
  lastName: z.string().max(200),
  email: z.string().max(254),
  phone: z.string().max(30).nullish().transform((v) => v ?? ""),
  topic: z.string().max(40),
  message: z.string().max(2000),
  consent: z.boolean(),
  // A field people never see (hidden in the form): only bots fill it in.
  website: z.string().max(200).nullish(),
});

export type ContactParseResult =
  | { ok: true; value: ContactMessageInput; isBot: boolean }
  | { ok: false; error: string };

export function parseContactRequest(body: unknown): ContactParseResult {
  const parsed = contactBody.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0]!;
    return { ok: false, error: `${issue.path.join(".") || "body"}: ${issue.message}` };
  }
  const { website, ...value } = parsed.data;
  return { ok: true, value, isBot: Boolean(website?.trim()) };
}
