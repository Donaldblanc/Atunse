"use client";

import { startTransition, useActionState, useRef, useState } from "react";
import { removeLogoAction, setLogoAction, type RemoveLogoState } from "./settings-actions";

const INITIAL: RemoveLogoState = { error: null };

/**
 * Business Logo: uploads straight to the storage target (ADR-0004, same
 * pattern as booking's photos), then tells the server which key to store
 * via setLogoAction. Remove clears it the same way removeLogoAction does.
 */
export function LogoUpload({ logoUrl }: { logoUrl: string | null }) {
  const [setState, setFormAction, setPending] = useActionState<RemoveLogoState, FormData>(setLogoAction, INITIAL);
  const [removeState, removeFormAction, removePending] = useActionState<RemoveLogoState, FormData>(removeLogoAction, INITIAL);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setUploading(true);
    setUploadError(null);
    try {
      const res = await fetch("/api/v1/admin/settings/logo-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: file.type, size: file.size }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "That upload didn't start.");
      const { upload } = data as { upload: { key: string; url: string; fields: Record<string, string> } };

      const body = new FormData();
      for (const [name, value] of Object.entries(upload.fields)) body.append(name, value);
      body.append("file", file);
      const putRes = await fetch(upload.url, { method: "POST", body });
      if (!putRes.ok) throw new Error("That upload didn't finish.");

      const confirm = new FormData();
      confirm.append("logoKey", upload.key);
      startTransition(() => setFormAction(confirm));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "That upload didn't finish.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="ov-card st-card">
      <h2 className="ov-card-title">Business Logo</h2>
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- a private, short-lived storage URL, not a Next-optimizable public asset
        <img src={logoUrl} alt="Business logo" className="st-logo-preview" />
      ) : (
        <p className="st-hint">No logo uploaded yet.</p>
      )}

      <div className="st-logo-actions">
        <button
          type="button"
          className="admin-btn"
          data-variant="secondary"
          disabled={uploading || setPending}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading || setPending ? "Uploading…" : "Upload Logo"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFile(file);
            event.target.value = "";
          }}
        />
        {logoUrl && (
          <form action={removeFormAction}>
            <button type="submit" className="admin-btn" data-variant="secondary" disabled={removePending}>
              Remove
            </button>
          </form>
        )}
      </div>
      {(uploadError || setState.error || removeState.error) && (
        <p role="alert" className="od-status-error st-error">
          {uploadError ?? setState.error ?? removeState.error}
        </p>
      )}
    </section>
  );
}
