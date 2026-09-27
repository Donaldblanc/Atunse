import { describe, expect, it } from "vitest";
import { maskEmail, redactForLog } from "./redact";

describe("log redaction", () => {
  it("masks emails", () => {
    expect(maskEmail("john@example.com")).toBe("j***@example.com");
    expect(maskEmail("nope")).toBe("***");
  });

  it("removes emails, sign-in codes, bearer tokens, signed tokens and presigned signatures from log text", () => {
    const line = [
      "failed for jordan.smith@example.com",
      "code 123456",
      "Authorization: Bearer abc.def-ghi",
      "cookie eyJhY2NvdW50SWQiOiJhIn0abcd.Zm9vYmFyYmF6cXV4cXV1eHh4eA",
      "https://s3.example.com/k?X-Amz-Credential=AKIA%2F&X-Amz-Signature=deadbeef&signature=abc",
    ].join(" | ");
    const out = redactForLog(line);
    expect(out).toContain("j***@example.com");
    for (const secret of ["jordan.smith@", "123456", "abc.def-ghi", "eyJhY2NvdW50SWQiOiJhIn0abcd", "deadbeef", "AKIA%2F"]) {
      expect(out).not.toContain(secret);
    }
  });

  it("leaves ordinary configuration messages readable", () => {
    expect(redactForLog("S3_BUCKET and S3_REGION (or AWS_REGION) must be set.")).toBe(
      "S3_BUCKET and S3_REGION (or AWS_REGION) must be set.",
    );
  });
});
