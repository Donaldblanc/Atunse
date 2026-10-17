"use client";

import { useActionState, useState } from "react";
import { changeAdminPasswordAction, updateAdminProfileAction, type ProfileState } from "./settings-actions";

const INITIAL: ProfileState = { error: null };

/**
 * Account Settings: the signed-in admin's own name/email, and a password
 * change (ADR-0005 addendum's interim credential auth — there's no managed
 * provider here yet, so "Change Password" is this account's own stored
 * hash, not an email reset flow).
 */
export function AccountSettingsForm({ accountId, name, email, hasPassword }: { accountId: string; name: string; email: string; hasPassword: boolean }) {
  const [passwords, setPasswords] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [profileState, profileAction, profilePending] = useActionState<ProfileState, FormData>(updateAdminProfileAction, INITIAL);
  const [passwordState, passwordAction, passwordPending] = useActionState<ProfileState, FormData>(async (previous, formData) => {
    const next = await changeAdminPasswordAction(previous, formData);
    if (!next.error) setPasswords({ currentPassword: "", newPassword: "", confirmPassword: "" }); // cleared only on success
    return next;
  }, INITIAL);

  // Controlled so the post-action form reset doesn't wipe typed values after an error.
  const [nameValue, setNameValue] = useState(name);
  const [emailValue, setEmailValue] = useState(email);
  const passwordField = (field: keyof typeof passwords) => ({
    name: field,
    value: passwords[field],
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => setPasswords({ ...passwords, [field]: event.target.value }),
  });

  return (
    <section className="ov-card st-card">
      <h2 className="ov-card-title">Account Settings</h2>

      <form action={profileAction} className="st-account-form">
        <input type="hidden" name="accountId" value={accountId} />
        <label className="st-field">
          Name
          <input name="name" value={nameValue} onChange={(event) => setNameValue(event.target.value)} maxLength={120} required className="st-input" />
        </label>
        <label className="st-field">
          Email
          <input type="email" name="email" value={emailValue} onChange={(event) => setEmailValue(event.target.value)} maxLength={254} required className="st-input" />
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
            <input type="password" {...passwordField("currentPassword")} autoComplete="current-password" required className="st-input" />
          </label>
          <label className="st-field">
            New password
            <input type="password" {...passwordField("newPassword")} autoComplete="new-password" minLength={8} required className="st-input" />
          </label>
          <label className="st-field">
            Confirm new password
            <input type="password" {...passwordField("confirmPassword")} autoComplete="new-password" minLength={8} required className="st-input" />
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
