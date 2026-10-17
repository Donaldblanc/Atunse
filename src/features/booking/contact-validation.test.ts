import { describe, expect, it } from "vitest";
import { EMPTY_CONTACT } from "./booking-types";
import { contactStepProblems } from "./contact-validation";

const NOW = new Date("2026-10-17T16:00:00Z");
const contact = { name: "Jordan", email: "j@example.com", phone: "2125550142", birthMonth: "3", birthYear: "1990" };

describe("contactStepProblems", () => {
  it("lets an adult with every field through", () => {
    expect(contactStepProblems(contact, NOW)).toEqual({ missingFields: [], formatProblem: null, isValid: true });
  });

  it("asks for a birth month and year left blank", () => {
    const result = contactStepProblems({ ...EMPTY_CONTACT, name: "J", email: "j@example.com", phone: "2125550142" }, NOW);
    expect(result.missingFields).toEqual(["birth month", "birth year"]);
    expect(result.isValid).toBe(false);
  });

  it("blocks Continue under 18, including the month of the 18th birthday, with the guardian message", () => {
    const message = "You need to be 18 or older to book. A parent or guardian can book for you.";
    expect(contactStepProblems({ ...contact, birthMonth: "10", birthYear: "2008" }, NOW)).toMatchObject({ formatProblem: message, isValid: false });
    expect(contactStepProblems({ ...contact, birthMonth: "6", birthYear: "2015" }, NOW)).toMatchObject({ formatProblem: message, isValid: false });
    expect(contactStepProblems({ ...contact, birthMonth: "9", birthYear: "2008" }, NOW).isValid).toBe(true);
  });
});
