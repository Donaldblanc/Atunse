// The DMCA Designated Agent (17 U.S.C. 512(c)(2)) named on /copyright. It
// comes from server-side env vars so no placeholder details are ever
// published: until name, address and email are all set, `dmcaAgent()` is
// null, /copyright answers 404 and the footer link is hidden. The owner
// registers the agent at copyright.gov separately (docs/TODO.md, Legal).

export interface DmcaAgent {
  name: string;
  /** Postal address, one entry per line. */
  addressLines: string[];
  email: string;
  phone?: string;
  /** Copyright Office registration number, e.g. DMCA-1234567. */
  registrationNumber?: string;
}

function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function dmcaAgent(env: NodeJS.ProcessEnv = process.env): DmcaAgent | null {
  const name = clean(env.DMCA_AGENT_NAME);
  // Env files can't hold real newlines, so a literal "\n" separates lines.
  const addressLines = (clean(env.DMCA_AGENT_ADDRESS) ?? "")
    .split(/\\n|\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const email = clean(env.DMCA_AGENT_EMAIL);
  if (!name || addressLines.length === 0 || !email) return null;
  return {
    name,
    addressLines,
    email,
    phone: clean(env.DMCA_AGENT_PHONE),
    registrationNumber: clean(env.DMCA_REGISTRATION_NUMBER),
  };
}
