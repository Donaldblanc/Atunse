// The Settings screen: Business Profile tab only (docs/TODO.md #182 — the
// other seven tabs aren't modeled yet and render as disabled "Soon"
// targets, same convention as the sidebar's unbuilt screens). Operating
// Hours has its own tab entry in the design, but renders inside this one
// page's scroll rather than as a second route (docs/plans/
// admin-screens-batch-2.md).
//
// Saving the Booking Settings toggles here (allowLocalDropOff/allowMailIn)
// doesn't yet change what /booking offers: the booking flow still reads
// pickup-window.ts, not BusinessSettings (docs/TODO.md #181).

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { actingUserFromCookies } from "@/features/accounts/acting-user";
import { getIntegrationsStatus } from "@/features/settings/integrations-status";
import { buildSettingsDeps } from "@/features/settings/deps";
import { getSettings } from "@/features/settings/use-cases/get-settings";
import { SettingsTabs } from "@/features/settings/settings-tabs";
import { SettingsForm } from "@/features/settings/settings-form";
import { LogoUpload } from "@/features/settings/logo-upload";
import { AccountSettingsForm } from "@/features/settings/account-settings-form";
import "@/styles/settings.css";

export const metadata = { title: "Settings · Atunṣe Admin" };

export default async function AdminSettingsPage() {
  const actingUser = await actingUserFromCookies(await cookies());
  const deps = buildSettingsDeps();
  const [{ business, hours, logoUrl }, admin, integrations] = await Promise.all([
    getSettings(deps, actingUser),
    actingUser.accountId ? deps.accounts.findAdminById(actingUser.accountId) : Promise.resolve(null),
    Promise.resolve(getIntegrationsStatus()),
  ]);

  return (
    <div className="st">
      <div className="st-head">
        <h1 className="st-title">Settings</h1>
      </div>
      <SettingsTabs active="business" />

      <div className="st-layout">
        <div className="st-main">
          <SettingsForm business={business} hours={hours} idempotencyKey={randomUUID()} />
        </div>

        <div className="st-side">
          <LogoUpload logoUrl={logoUrl} />
          <AccountSettingsForm accountId={admin?.id ?? ""} name={admin?.name ?? ""} email={admin?.email ?? ""} hasPassword={Boolean(admin?.passwordHash)} />

          <section className="ov-card st-card">
            <h2 className="ov-card-title">Integrations</h2>
            <ul className="st-integrations">
              <IntegrationRow label="Stripe" connected={integrations.stripe} />
              <IntegrationRow label="Email" connected={integrations.email} />
              <IntegrationRow label="SMS" connected={integrations.sms} />
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

function IntegrationRow({ label, connected }: { label: string; connected: boolean }) {
  return (
    <li className="st-integration-row">
      <span>{label}</span>
      <span className="st-pill" data-connected={connected ? "true" : "false"}>
        {connected ? "Connected" : "Not Connected"}
      </span>
    </li>
  );
}
