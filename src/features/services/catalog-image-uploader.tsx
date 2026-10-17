"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { XIcon, PlusIcon } from "@phosphor-icons/react/dist/ssr";
import type { CatalogImage } from "./repositories/catalog-repository";
import type { CatalogImageActionResult, RequestImageUploadResult } from "./catalog-actions";

const MAX_IMAGES = 5;

/**
 * Edit Service/Bundle's "Service Images": up to 5 photos, uploaded straight
 * to storage with a presigned target (ADR-0004) so the app server never
 * proxies the bytes. `requestUpload` mints the target, `addImage` records
 * the key once the browser's upload finishes, `removeImage` takes one off.
 */
export function CatalogImageUploader({
  entityId,
  images,
  requestUpload,
  addImage,
  removeImage,
}: {
  entityId: string;
  images: CatalogImage[];
  requestUpload: (entityId: string, contentType: string, size: number) => Promise<RequestImageUploadResult>;
  addImage: (entityId: string, key: string) => Promise<CatalogImageActionResult>;
  removeImage: (entityId: string, imageId: string) => Promise<CatalogImageActionResult>;
}) {
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
      const requested = await requestUpload(entityId, file.type, file.size);
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
      const added = await addImage(entityId, upload.key);
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
      const result = await removeImage(entityId, imageId);
      if ("error" in result) setError(result.error);
      else router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sv-images">
      <p className="sv-images-label">
        Service Images <span className="sv-muted">Upload up to {MAX_IMAGES} images. Recommended size: 1200 x 800px.</span>
      </p>
      {error && (
        <p role="alert" className="sv-error">
          {error}
        </p>
      )}
      <div className="sv-images-grid">
        {images.map((image) => (
          <div key={image.id} className="sv-image-thumb">
            {/* Thumbnails don't resolve the storage key to a view URL here: the list page keeps this uploader lightweight. A dedicated view route can follow. */}
            <div className="sv-image-placeholder" aria-hidden="true" />
            <button type="button" className="sv-image-remove" aria-label="Remove image" disabled={busy} onClick={() => onRemove(image.id)}>
              <XIcon size={14} aria-hidden="true" />
            </button>
          </div>
        ))}
        {images.length < MAX_IMAGES && (
          <button type="button" className="sv-image-add" disabled={busy} onClick={() => inputRef.current?.click()}>
            <PlusIcon size={20} aria-hidden="true" />
            Add Image
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" className="sr-only" onChange={onPick} />
    </div>
  );
}
