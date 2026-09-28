"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { ArrowRight, CalendarDays, Check, MapPin, MessageCircle, Package, TriangleAlert, type LucideIcon } from "lucide-react";
import { PRIVACY_POLICY } from "@/shared/legal-documents";
import {
  CONTACT_MESSAGE_MAX,
  CONTACT_TOPICS,
  ContactValidationError,
  isContactTopic,
  validateContactMessage,
  type ContactTopicId,
} from "./contact-message";

type Card = {
  icon: LucideIcon;
  title: string;
  description: string;
  action: string;
} & ({ topic: ContactTopicId } | { href: string });

// Each card either picks the form's topic (and jumps to the form) or links
// elsewhere. The card for the chosen topic is highlighted.
const CARDS: Card[] = [
  {
    icon: MessageCircle,
    title: "General Inquiries",
    description: "Questions about services, pricing, or custom requests.",
    action: "Send us a message",
    topic: "general",
  },
  {
    icon: CalendarDays,
    title: "Booking Support",
    description: "Need help with an existing booking or scheduling?",
    action: "Go to booking support",
    topic: "booking",
  },
  {
    icon: Package,
    title: "Custom Requests",
    description: "Have a unique pair or special request?",
    action: "Start a conversation",
    topic: "custom",
  },
  {
    icon: MapPin,
    title: "Service Area",
    description: "Local pickup in NY / NJ / CT, plus nationwide mail-in.",
    action: "View our process",
    href: "/process",
  },
];

const EMPTY = { firstName: "", lastName: "", email: "", phone: "", message: "", website: "" };

export function ContactSection({ initialTopic }: { initialTopic: string | null }) {
  const [fields, setFields] = useState(EMPTY);
  const [topic, setTopic] = useState<string>(initialTopic && isContactTopic(initialTopic) ? initialTopic : "");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<{ firstName: string; email: string } | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);

  function pickTopic(id: ContactTopicId) {
    setTopic(id);
    setSentTo(null);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    // After the form is back (it may be showing the "sent" panel).
    requestAnimationFrame(() => messageRef.current?.focus({ preventScroll: true }));
  }

  function set<K extends keyof typeof EMPTY>(key: K, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (sending) return;
    const input = { ...fields, topic, consent };
    try {
      validateContactMessage(input);
    } catch (err) {
      setError(err instanceof ContactValidationError ? err.message : "Check the form and try again.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: unknown };
        setError(typeof body.error === "string" ? body.error : "We couldn't send your message. Please try again.");
        return;
      }
      setSentTo({ firstName: fields.firstName.trim(), email: fields.email.trim() });
      setFields(EMPTY);
      setConsent(false);
    } catch {
      setError("We couldn't send your message. Check your connection and try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="contact-main" aria-label="Ways to reach us">
      <ul className="contact-cards">
        {CARDS.map((card) => {
          const Icon = card.icon;
          const active = "topic" in card && card.topic === topic;
          return (
            <li className="contact-card" data-active={active} key={card.title}>
              <span className="contact-card-icon" aria-hidden="true">
                <Icon size={22} />
              </span>
              <div>
                <h2>{card.title}</h2>
                <p>{card.description}</p>
                {"topic" in card ? (
                  <button type="button" className="contact-card-action" onClick={() => pickTopic(card.topic)}>
                    {card.action}
                    <ArrowRight size={14} aria-hidden="true" />
                  </button>
                ) : (
                  <Link className="contact-card-action" href={card.href}>
                    {card.action}
                    <ArrowRight size={14} aria-hidden="true" />
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="contact-form-card" id="contact-form" ref={formRef}>
        {sentTo ? (
          <div className="contact-sent" role="status">
            <span className="contact-sent-icon" aria-hidden="true">
              <Check size={22} />
            </span>
            <h2>Message sent.</h2>
            <p>
              Thanks{sentTo.firstName ? `, ${sentTo.firstName}` : ""}. We&rsquo;ll reply to <strong>{sentTo.email}</strong> as soon as we
              can.
            </p>
            <button type="button" className="landing-link-arrow" onClick={() => setSentTo(null)}>
              Send another message
              <ArrowRight size={14} aria-hidden="true" />
            </button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            <h2>Send us a message</h2>
            <p className="contact-form-lede">Fill out the form below and we&rsquo;ll get back to you shortly.</p>

            <div className="booking-page-form-grid">
              <label className="booking-page-field">
                <span>
                  First name <Required />
                </span>
                <input autoComplete="given-name" placeholder="John" value={fields.firstName} onChange={(e) => set("firstName", e.target.value)} />
              </label>
              <label className="booking-page-field">
                <span>
                  Last name <Required />
                </span>
                <input autoComplete="family-name" placeholder="Doe" value={fields.lastName} onChange={(e) => set("lastName", e.target.value)} />
              </label>
              <label className="booking-page-field">
                <span>
                  Email address <Required />
                </span>
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={fields.email}
                  onChange={(e) => set("email", e.target.value)}
                />
              </label>
              <label className="booking-page-field">
                <span>Phone number (optional)</span>
                <input
                  type="tel"
                  autoComplete="tel"
                  placeholder="(123) 456-7890"
                  value={fields.phone}
                  onChange={(e) => set("phone", e.target.value)}
                />
              </label>
            </div>

            <label className="booking-page-field contact-field-full">
              <span>
                Topic <Required />
              </span>
              <select value={topic} onChange={(e) => setTopic(e.target.value)}>
                <option value="" disabled>
                  Select a topic
                </option>
                {CONTACT_TOPICS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="booking-page-field contact-field-full">
              <span>
                Message <Required />
              </span>
              <textarea
                ref={messageRef}
                maxLength={CONTACT_MESSAGE_MAX}
                placeholder="Share as much detail as possible…"
                value={fields.message}
                onChange={(e) => set("message", e.target.value)}
              />
              <span className="booking-page-char-count">
                {fields.message.length}/{CONTACT_MESSAGE_MAX}
              </span>
            </label>

            {/* Honeypot: hidden from people, filled in by bots. */}
            <input
              className="contact-honeypot"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              value={fields.website}
              onChange={(e) => set("website", e.target.value)}
            />

            <label className="booking-page-policy">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>
                I agree to be contacted by Atunṣe and have read the{" "}
                <a href={PRIVACY_POLICY.href} target="_blank" rel="noopener noreferrer">
                  {PRIVACY_POLICY.title}
                  <span className="landing-visually-hidden"> (PDF, opens in a new tab)</span>
                </a>
                .
              </span>
            </label>

            <button type="submit" className="landing-btn-primary booking-page-continue-btn" disabled={sending} aria-busy={sending}>
              {sending ? "Sending…" : "Send Message"}
              {!sending && <ArrowRight size={14} aria-hidden="true" />}
            </button>
            {error && (
              <p className="booking-page-form-error" role="alert">
                <TriangleAlert size={14} aria-hidden="true" />
                {error}
              </p>
            )}
          </form>
        )}
      </div>
    </section>
  );
}

function Required() {
  return (
    <span className="booking-page-required" aria-hidden="true">
      *
    </span>
  );
}
