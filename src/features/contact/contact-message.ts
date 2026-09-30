// The contact form (/contact): a customer's message, emailed to the shop's
// inbox with Reply-To set to the customer, so the owner answers from their
// own mail client. Nothing is stored: the inbox is the record. Pure rules
// and the use-case live here; the route only parses and rate-limits.

import { isValidEmail, isValidUsPhone } from "@/features/orders/contact-rules";
import type { NotificationService } from "@/features/notifications/notification-service";
import { PRIVACY_POLICY } from "@/shared/legal-documents";

export const CONTACT_TOPICS = [
  { id: "general", label: "General inquiry" },
  { id: "booking", label: "Booking support" },
  { id: "custom", label: "Custom request" },
  { id: "other", label: "Something else" },
] as const;

export type ContactTopicId = (typeof CONTACT_TOPICS)[number]["id"];

export const CONTACT_MESSAGE_MAX = 500;
export const CONTACT_NAME_MAX = 80;

export interface ContactMessageInput {
  firstName: string;
  lastName: string;
  email: string;
  /** Optional: blank when not given. */
  phone: string;
  topic: string;
  message: string;
  /** "I agree to be contacted by Atunse and have read the Privacy Policy." */
  consent: boolean;
}

export interface ContactDeps {
  notifications: NotificationService;
  /** The shop's inbox (CONTACT_EMAIL), or null when it isn't configured. */
  inbox: string | null;
  now?: () => Date;
}

/** The message breaks a rule; `message` is safe to show the customer. */
export class ContactValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContactValidationError";
  }
}

/** CONTACT_EMAIL isn't set in production: there's nowhere to send messages. */
export class ContactInboxNotConfiguredError extends Error {
  constructor() {
    super("The contact inbox (CONTACT_EMAIL) isn't configured.");
    this.name = "ContactInboxNotConfiguredError";
  }
}

export function isContactTopic(id: string): id is ContactTopicId {
  return CONTACT_TOPICS.some((topic) => topic.id === id);
}

export function contactTopicLabel(id: ContactTopicId): string {
  return CONTACT_TOPICS.find((topic) => topic.id === id)!.label;
}

/** Trimmed, checked fields, or a ContactValidationError naming the first problem. */
export function validateContactMessage(input: ContactMessageInput) {
  const firstName = oneLine(input.firstName);
  const lastName = oneLine(input.lastName);
  const email = input.email.trim();
  const phone = input.phone.trim();
  const message = input.message.trim();

  if (!firstName || !lastName) throw new ContactValidationError("Enter your first and last name.");
  if (firstName.length > CONTACT_NAME_MAX || lastName.length > CONTACT_NAME_MAX) {
    throw new ContactValidationError(`Keep each name under ${CONTACT_NAME_MAX} characters.`);
  }
  if (!isValidEmail(email)) throw new ContactValidationError("Enter a valid email address.");
  if (phone && !isValidUsPhone(phone)) throw new ContactValidationError("Enter a valid 10-digit US phone number, or leave it blank.");
  if (!isContactTopic(input.topic)) throw new ContactValidationError("Choose a topic.");
  if (!message) throw new ContactValidationError("Enter a message.");
  if (message.length > CONTACT_MESSAGE_MAX) {
    throw new ContactValidationError(`Keep your message under ${CONTACT_MESSAGE_MAX} characters.`);
  }
  if (!input.consent) throw new ContactValidationError("Agree to be contacted so we can reply.");
  return { firstName, lastName, email, phone, topic: input.topic, message };
}

/** Emails the message to the shop's inbox; replies go straight to the customer. */
export async function sendContactMessage(deps: ContactDeps, input: ContactMessageInput): Promise<void> {
  const fields = validateContactMessage(input);
  if (!deps.inbox) throw new ContactInboxNotConfiguredError();
  const now = deps.now?.() ?? new Date();
  const name = `${fields.firstName} ${fields.lastName}`;
  await deps.notifications.sendEmail({
    to: deps.inbox,
    replyTo: fields.email,
    subject: `Contact form: ${contactTopicLabel(fields.topic)} from ${name}`,
    body: [
      `${name} wrote in through the contact form. Reply to this email to answer them.`,
      `Topic: ${contactTopicLabel(fields.topic)}`,
      `Email: ${fields.email}`,
      `Phone: ${fields.phone || "not given"}`,
      `Message:\n${fields.message}`,
      `They agreed to be contacted and confirmed reading the ${PRIVACY_POLICY.title} (version ${PRIVACY_POLICY.version}) at ${now.toISOString()}.`,
    ].join("\n\n"),
  });
}

/**
 * The inbox from CONTACT_EMAIL. Unset in development, messages go to a
 * placeholder the console notification service just logs; unset in
 * production, there's no inbox and the form reports it's unavailable.
 */
export function contactInboxFromEnv(env: NodeJS.ProcessEnv = process.env): string | null {
  const inbox = env.CONTACT_EMAIL?.trim();
  if (inbox) return inbox;
  return env.NODE_ENV === "production" ? null : "contact-inbox@localhost";
}

/** Collapses line breaks and runs of whitespace: names go into an email subject. */
function oneLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}
