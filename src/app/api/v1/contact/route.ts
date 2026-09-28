import { NextResponse, type NextRequest } from "next/server";
import { notificationServiceFromEnv } from "@/features/notifications";
import { parseContactRequest } from "@/features/contact/contact-request";
import {
  contactInboxFromEnv,
  ContactInboxNotConfiguredError,
  ContactValidationError,
  sendContactMessage,
} from "@/features/contact/contact-message";
import { limitByIp, RATE_LIMITS } from "@/shared/rate-limit";

// POST /api/v1/contact — the /contact page's form. Public, rate-limited
// per caller. Emails the shop's inbox (CONTACT_EMAIL) with Reply-To set to
// the customer. A filled-in honeypot field gets the same 202 as a real
// message, so bots can't tell they were dropped.
export async function POST(req: NextRequest) {
  const limited = await limitByIp(req, RATE_LIMITS.contact);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = parseContactRequest(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  if (parsed.isBot) return NextResponse.json({ ok: true }, { status: 202 });

  try {
    await sendContactMessage({ notifications: notificationServiceFromEnv(), inbox: contactInboxFromEnv() }, parsed.value);
  } catch (err) {
    if (err instanceof ContactValidationError) return NextResponse.json({ error: err.message }, { status: 400 });
    if (err instanceof ContactInboxNotConfiguredError) {
      console.error("[contact]", err.message);
      return NextResponse.json({ error: "Our contact form is unavailable right now. Please try again later." }, { status: 503 });
    }
    console.error("[contact] sending failed", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "We couldn't send your message. Please try again in a moment." }, { status: 502 });
  }
  return NextResponse.json({ ok: true }, { status: 202 });
}
