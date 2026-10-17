import { AGE_REQUIREMENT_MESSAGE, isAdultByBirthMonth } from "@/features/orders/age";
import { isValidEmail, isValidUsPhone } from "@/features/orders/contact-rules";
import type { ContactInfo } from "./booking-types";

/**
 * What stops the Your Info step's Continue button: required fields left
 * blank, else the first format problem (email, phone, then the 18+ rule).
 * submitOrder enforces the same rules again on the server.
 */
export function contactStepProblems(contact: ContactInfo, now: Date) {
  const missingFields = [
    !contact.name.trim() && "name",
    !contact.email.trim() && "email",
    !contact.phone.trim() && "phone",
    !contact.birthMonth && "birth month",
    !contact.birthYear && "birth year",
  ].filter((f): f is string => Boolean(f));
  const formatProblem =
    missingFields.length > 0
      ? null
      : !isValidEmail(contact.email)
        ? "Please enter a valid email address to continue."
        : !isValidUsPhone(contact.phone)
          ? "Please enter a 10-digit US phone number to continue."
          : !isAdultByBirthMonth(Number(contact.birthMonth), Number(contact.birthYear), now)
            ? AGE_REQUIREMENT_MESSAGE
            : null;
  return { missingFields, formatProblem, isValid: missingFields.length === 0 && formatProblem === null };
}
