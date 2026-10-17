import { randomUUID } from "node:crypto";
import type { ActingUser } from "@/features/accounts/authz";
import { requireRole } from "@/features/accounts/authz";
import type { FileStorage, UploadTarget } from "@/shared/storage/file-storage";

const MAX_LOGO_BYTES = 5 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = ["image/png", "image/jpeg", "image/webp"];

/** Every logo key starts with this; setLogo refuses any other. */
export const LOGO_KEY_PREFIX = "business-logo/";

/** The exact shape requestLogoUpload issues: the prefix and a random UUID, nothing else. */
export const LOGO_KEY_PATTERN = /^business-logo\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export class InvalidLogoUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidLogoUploadError";
  }
}

/**
 * Business Logo's upload target, same FileStorage adapter as Service
 * images (ADR-0004). The key is random, not derived from the file name, so
 * nothing about the admin's machine leaks into storage.
 */
export async function requestLogoUpload(
  deps: { storage: FileStorage },
  actingUser: ActingUser,
  input: { contentType: string; size: number },
): Promise<UploadTarget & { key: string }> {
  requireRole(actingUser, "ADMIN");

  if (!ALLOWED_CONTENT_TYPES.includes(input.contentType)) throw new InvalidLogoUploadError("The logo must be a PNG, JPEG or WebP image.");
  if (input.size <= 0 || input.size > MAX_LOGO_BYTES) throw new InvalidLogoUploadError("The logo must be under 5 MB.");

  const key = `${LOGO_KEY_PREFIX}${randomUUID()}`;
  const target = await deps.storage.createUploadTarget({ key, contentType: input.contentType, maxBytes: MAX_LOGO_BYTES });
  return { key, ...target };
}
