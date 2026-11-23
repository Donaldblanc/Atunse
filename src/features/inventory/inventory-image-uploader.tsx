"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { PlusIcon, XIcon } from "@phosphor-icons/react/dist/ssr";
import { addInventoryImageAction, removeInventoryImageAction, requestInventoryImageUploadAction } from "./inventory-actions";
import { MAX_INVENTORY_IMAGES, type InventoryImage } from "./repositories/inventory-repository";

/**
 * Product Images: up to 5 photos, uploaded straight to storage with a presigned
 * target (ADR-0004) so the app server never proxies the bytes. `urls` are
 * short-lived view links made by the page (the bucket is private); a null one
 * (storage not reachable) shows a plain placeholder.
 */
export function InventoryImageUploader({ itemId, images, urls }: { itemId: string; images: InventoryImage[]; urls: Record<string, string | null> }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setBusy(true);
    setError(null);
    try {
      const requested = await requestInventoryImageUploadAction(itemId, file.type, file.size);
      if ("error" in requested) {
        setError(requested.error);
        return;
      }
      const { upload } = requested;
      const body = new FormData();
      for (const [key, value] of Object.entries(upload.fields)) body.set(key, value);
      body.set("file", file);
      const uploadResponse = await fetch(upload.url, { method: "POST", body });
      if (!uploadResponse.ok) {
        setError("That image couldn't be uploaded. Try again.");
        return;
      }
      const added = await addInventoryImageAction(itemId, upload.key);
      if ("error" in added) {
        setError(added.error);
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function onRemove(imageId: string) {
    setBusy(true);
    setError(null);
    try {
      const result = await removeInventoryImageAction(itemId, imageId);
      if ("error" in result) setError(result.error);
      else router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="inv-images">
      <h3 className="inv-section-title">
        Product Images <span className="inv-muted">Up to {MAX_INVENTORY_IMAGES}.</span>
      </h3>
      {error && (
        <p role="alert" className="inv-error">
          {error}
        </p>
      )}
      <div className="inv-images-grid">
        {images.map((image) => (
          <div key={image.id} className="inv-image-thumb">
            {urls[image.id] ? (
              // eslint-disable-next-line @next/next/no-img-element -- a short-lived signed storage URL, not a static asset
              <img src={urls[image.id] ?? undefined} alt="" className="inv-image" />
            ) : (
              <div className="inv-image-placeholder" aria-hidden="true" />
            )}
            <button type="button" className="inv-image-remove" aria-label="Remove image" disabled={busy} onClick={() => onRemove(image.id)}>
              <XIcon size={14} aria-hidden="true" />
            </button>
          </div>
        ))}
        {images.length < MAX_INVENTORY_IMAGES && (
          <button type="button" className="inv-image-add" disabled={busy} onClick={() => inputRef.current?.click()}>
            <PlusIcon size={20} aria-hidden="true" />
            Add Image
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" className="sr-only" onChange={onPick} />
    </div>
  );
}
