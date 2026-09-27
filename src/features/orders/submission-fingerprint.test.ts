import { describe, expect, it } from "vitest";
import { submissionFingerprint } from "./submission-fingerprint";
import { validBookingInput } from "./use-cases/test-fixtures";

describe("submissionFingerprint", () => {
  it("is stable for the same booking, whatever the key order", () => {
    const input = validBookingInput();
    const reordered = JSON.parse(JSON.stringify({ items: input.items, bundleId: input.bundleId, rush: input.rush, fulfillment: input.fulfillment, contact: input.contact }));
    expect(submissionFingerprint({ ...reordered, submissionKey: null, policyAccepted: true, acknowledgedTerms: [] })).toBe(
      submissionFingerprint(input),
    );
  });

  it("changes when any booking detail changes", () => {
    const base = submissionFingerprint(validBookingInput());
    expect(submissionFingerprint(validBookingInput({ rush: true }))).not.toBe(base);
    const moved = validBookingInput();
    moved.fulfillment = { ...moved.fulfillment, address: { ...moved.fulfillment.address, line1: "9 Other St" } };
    expect(submissionFingerprint(moved)).not.toBe(base);
  });

  it("ignores the submission key, the policy checkbox and the acknowledgements, which aren't part of the booking", () => {
    expect(submissionFingerprint(validBookingInput({ submissionKey: "a" }))).toBe(
      submissionFingerprint(validBookingInput({ submissionKey: "b" })),
    );
    expect(submissionFingerprint(validBookingInput({ acknowledgedTerms: [] }))).toBe(submissionFingerprint(validBookingInput()));
  });
});
