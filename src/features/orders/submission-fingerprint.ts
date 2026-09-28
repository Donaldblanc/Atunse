import { createHash } from "node:crypto";
import type { SubmitOrderInput } from "./use-cases/submit-order";

/**
 * A hash of what the customer submitted (#76), stored with the submission
 * key. A retry with the same key and the same booking returns the existing
 * Order; the same key with different details (e.g. the first Confirm went
 * through but its response was lost, and the customer then edited the
 * address) is refused instead of silently returning the stale Order.
 * The key, the policy checkbox and the acknowledgments aren't part of
 * the booking itself.
 */
export function submissionFingerprint(input: SubmitOrderInput): string {
  const { submissionKey: _key, policyAccepted: _policy, acknowledgedTerms: _terms, ...booking } = input;
  return createHash("sha256").update(canonicalJson(booking)).digest("hex");
}

/** JSON with object keys sorted, so key order never changes the hash. */
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
