"use client";

import { useActionState } from "react";
import { changeAdminPasswordAction, updateAdminProfileAction, type ProfileState } from "./settings-actions";

const INITIAL: ProfileState = { error: null };

/**
 * Account Settings: the signed-in admin's own name/email, and a password
 * change (ADR-0005 addendum's interim credential auth — there's no managed
 * provider here yet, so "Change Password" is this account's own stored
 * hash, not an email reset flow).
 */
export function AccountSettingsForm({ accountId, name, email, hasPassword }: { accountId: string; name: string; email: string; hasPassword: boolean }) {
  const [profileState, profileAction, profilePending] = useActionState<ProfileState, FormData>(updateAdminProfileAction, INITIAL);
  const [passwordState, passwordAction, passwordPending] = useActionState<ProfileState, FormData>(changeAdminPasswordAction, INITIAL);

  return (
    <section className="ov-card st-card">
      <h2 className="ov-card-title">Account Settings</h2>

      <form action={profileAction} className="st-account-form">
        <input type="hidden" name="accountId" value={accountId} />
        <label className="st-field">
          Name
          <input name="name" defaultValue={name} maxLength={120} required className="st-input" />
        </label>
        <label className="st-field">
          Email
          <input type="email" name="email" defaultValue={email} maxLength={254} required className="st-input" />
        </label>
        {profileState.error && (
          <p role="alert" className="od-status-error st-error">
            {profileState.error}
          </p>
        )}
        <button type="submit" className="admin-btn" data-variant="secondary" disabled={profilePending}>
          {profilePending ? "Saving…" : "Save"}
        </button>
      </form>

      {hasPassword && (
        <form action={passwordAction} className="st-account-form">
          <input type="hidden" name="accountId" value={accountId} />
          <label className="st-field">
            Current password
            <input type="password" name="currentPassword" autoComplete="current-password" required className="st-input" />
          </label>
          <label className="st-field">
            New password
            <input type="password" name="newPassword" autoComplete="new-password" minLength={8} required className="st-input" />
          </label>
          <label className="st-field">
            Confirm new password
            <input type="password" name="confirmPassword" autoComplete="new-password" minLength={8} required className="st-input" />
          </label>
          {passwordState.error && (
            <p role="alert" className="od-status-error st-error">
              {passwordState.error}
            </p>
          )}
          <button type="submit" className="admin-btn" data-variant="secondary" disabled={passwordPending}>
            {passwordPending ? "Changing…" : "Change Password"}
          </button>
        </form>
      )}
    </section>
  );
}
