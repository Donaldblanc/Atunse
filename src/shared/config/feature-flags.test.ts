import { describe, expect, it } from "vitest";
import { isCustomerSignInEnabled } from "./feature-flags";

describe("isCustomerSignInEnabled", () => {
  it("is on only for the literal 'true'", () => {
    expect(isCustomerSignInEnabled({ NODE_ENV: "test", FEATURE_CUSTOMER_SIGN_IN_ENABLED: "true" })).toBe(true);
    expect(isCustomerSignInEnabled({ NODE_ENV: "test", FEATURE_CUSTOMER_SIGN_IN_ENABLED: " TRUE " })).toBe(true);
    for (const value of [undefined, "", "false", "1", "yes"]) {
      expect(isCustomerSignInEnabled({ NODE_ENV: "test", FEATURE_CUSTOMER_SIGN_IN_ENABLED: value })).toBe(false);
    }
  });
});
