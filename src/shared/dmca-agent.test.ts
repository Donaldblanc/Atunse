import { describe, expect, it } from "vitest";
import { dmcaAgent } from "./dmca-agent";

const base = { DMCA_AGENT_NAME: "Jane Doe", DMCA_AGENT_ADDRESS: "1 Main St\\nNew York, NY 10001", DMCA_AGENT_EMAIL: "dmca@example.com" };

describe("dmcaAgent", () => {
  it("is null when nothing is set", () => {
    expect(dmcaAgent({})).toBeNull();
  });

  it.each(["DMCA_AGENT_NAME", "DMCA_AGENT_ADDRESS", "DMCA_AGENT_EMAIL"])("is null when %s is missing or blank", (key) => {
    expect(dmcaAgent({ ...base, [key]: undefined })).toBeNull();
    expect(dmcaAgent({ ...base, [key]: "   " })).toBeNull();
  });

  it("parses the required fields, splitting the address on escaped newlines", () => {
    expect(dmcaAgent(base)).toEqual({
      name: "Jane Doe",
      addressLines: ["1 Main St", "New York, NY 10001"],
      email: "dmca@example.com",
      phone: undefined,
      registrationNumber: undefined,
    });
  });

  it("includes the optional phone and registration number, trimmed", () => {
    const agent = dmcaAgent({ ...base, DMCA_AGENT_PHONE: " 555-0100 ", DMCA_REGISTRATION_NUMBER: " DMCA-1234567 " });
    expect(agent?.phone).toBe("555-0100");
    expect(agent?.registrationNumber).toBe("DMCA-1234567");
  });
});
