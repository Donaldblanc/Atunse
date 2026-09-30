// Browser side of "Confirm Booking": uploads each pair's photos straight to
// storage (ADR-0004), then submits the Order with their keys. Split out of
// the React components so the request shape is unit-testable.

import type { SubmitOrderResponse } from "@/features/orders/api/submit-order-request";
import type { PickupSelection } from "./pickup-date-picker";
import { calendarDateInLocalTime } from "@/features/orders/calendar-date";
import type { ContactInfo, PairDetails, PickupAddress, ScheduleMethod } from "./booking-types";

export type { SubmitOrderResponse };

export interface BookingSubmission {
  submissionKey: string;
  policyAccepted: boolean;
  /** The BOOKING_ACKNOWLEDGMENTS ids the customer ticked on the Review step. */
  acknowledgedTerms: string[];
  /** The TERMS_AGREEMENT version the Review step showed (ADR-0015). */
  termsVersion: string;
  /** The Bundle chosen, or null for a single pair. */
  bundleId: string | null;
  /** The single pair's Services; empty for a Bundle, whose Services come with it. */
  serviceIds: string[];
  /** One pair, or a Bundle's three, each with its own Add-ons. */
  pairs: PairDetails[];
  scheduleMethod: ScheduleMethod;
  address: PickupAddress;
  pickupSelection: PickupSelection | null;
  mailInDate: PickupSelection | null;
  contact: ContactInfo;
  rush: boolean;
}

/**
 * A failure whose message is safe to show the customer. `code` is
 * SIGN_IN_REQUIRED when the email already has an Account and the customer
 * has to sign in (the booking flow's login screen) before resubmitting.
 */
export class BookingSubmitError extends Error {
  constructor(
    message: string,
    readonly code?: string,
    /** With SUBMISSION_CONFLICT: the booking that already went through. */
    readonly existing?: SubmitOrderResponse,
  ) {
    super(message);
    this.name = "BookingSubmitError";
  }
}

/** Server answers meaning "upload the photos again", not "resend the same keys". */
const REUPLOAD_CODES = ["PHOTOS_IN_USE", "PHOTOS_NOT_UPLOADED"];

const GENERIC_FAILURE = "Something went wrong submitting your booking. Please try again.";

export function buildOrderRequestBody(submission: BookingSubmission, photoKeysByPair: string[][]) {
  const { address } = submission;
  const orderAddress = {
    line1: address.address,
    line2: address.apt || null,
    city: address.city,
    state: address.state,
    zip: address.zip,
  };

  let fulfillment;
  if (submission.scheduleMethod === "pickup") {
    if (!submission.pickupSelection) throw new BookingSubmitError("Choose a collection date and time.");
    fulfillment = {
      method: "PICKUP" as const,
      address: orderAddress,
      date: calendarDateInLocalTime(submission.pickupSelection.date),
      slot: submission.pickupSelection.time,
    };
  } else {
    fulfillment = {
      method: "MAIL_IN" as const,
      address: orderAddress,
      preferredDate: submission.mailInDate ? calendarDateInLocalTime(submission.mailInDate.date) : null,
    };
  }

  return {
    policyAccepted: submission.policyAccepted,
    acknowledgedTerms: submission.acknowledgedTerms,
    termsVersion: submission.termsVersion,
    contact: submission.contact,
    fulfillment,
    rush: submission.rush,
    bundleId: submission.bundleId,
    items: submission.pairs.map((pair, i) => ({
      brand: pair.brand || null,
      material: pair.material || null,
      notes: pair.notes || null,
      // Each pair's Add-ons ride along with its Services (a Bundle pair's alone).
      serviceIds: [...submission.serviceIds, ...pair.addOnIds],
      photoKeys: photoKeysByPair[i] ?? [],
    })),
  };
}

async function errorFrom(res: Response): Promise<BookingSubmitError> {
  try {
    const body = (await res.json()) as { error?: unknown; code?: unknown; existing?: SubmitOrderResponse };
    return new BookingSubmitError(
      typeof body.error === "string" ? body.error : GENERIC_FAILURE,
      typeof body.code === "string" ? body.code : undefined,
      body.existing,
    );
  } catch {
    return new BookingSubmitError(GENERIC_FAILURE);
  }
}

/**
 * Storage keys of photos already uploaded during this booking (#78), keyed
 * by the File the customer picked. Retries reuse them instead of uploading
 * every photo again, which also keeps the submitted booking identical, so
 * a retry is recognized as the same submission (#76).
 */
export type UploadedPhotoKeys = WeakMap<File, string>;

async function uploadPhotos(photos: File[], uploaded: UploadedPhotoKeys, fetchImpl: typeof fetch): Promise<string[]> {
  const pending = photos.filter((photo) => !uploaded.has(photo));
  if (pending.length > 0) {
    const res = await fetchImpl("/api/v1/uploads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ files: pending.map((photo) => ({ contentType: photo.type, size: photo.size })) }),
    });
    if (!res.ok) throw await errorFrom(res);
    const { uploads } = (await res.json()) as { uploads: { key: string; url: string; fields: Record<string, string> }[] };

    await Promise.all(
      uploads.map(async (upload, index) => {
        const photo = pending[index]!;
        const form = new FormData();
        for (const [name, value] of Object.entries(upload.fields)) form.append(name, value);
        form.append("file", photo); // storage requires the file last
        const res = await fetchImpl(upload.url, { method: "POST", body: form });
        if (!res.ok) throw new BookingSubmitError("One of your photos didn't upload. Please try again.");
        uploaded.set(photo, upload.key); // only once it's really in storage
      }),
    );
  }
  return photos.map((photo) => uploaded.get(photo)!);
}

export async function submitBooking(
  submission: BookingSubmission,
  uploaded: UploadedPhotoKeys = new WeakMap(),
  fetchImpl: typeof fetch = fetch,
): Promise<SubmitOrderResponse> {
  // Validate the request shape before spending time on uploads.
  buildOrderRequestBody(submission, []);
  const allPhotos = submission.pairs.flatMap((pair) => pair.photos);

  const attempt = async () => {
    // One uploads request per pair (the route takes at most one pair's
    // photos, MAX_PHOTOS_PER_ITEM, per request), all pairs at once.
    const photoKeys = await Promise.all(submission.pairs.map((pair) => uploadPhotos(pair.photos, uploaded, fetchImpl)));
    const res = await fetchImpl("/api/v1/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": submission.submissionKey },
      body: JSON.stringify(buildOrderRequestBody(submission, photoKeys)),
    });
    if (!res.ok) throw await errorFrom(res);
    return (await res.json()) as SubmitOrderResponse;
  };

  try {
    try {
      return await attempt();
    } catch (err) {
      // The server can't use the photo keys this booking remembered: gone
      // from storage (e.g. cleaned up while the tab sat open), or already
      // attached to another booking. Resending them would fail forever, so
      // forget them and upload once more.
      if (!(err instanceof BookingSubmitError && REUPLOAD_CODES.includes(err.code ?? ""))) throw err;
      for (const photo of allPhotos) uploaded.delete(photo);
      return await attempt();
    }
  } catch (err) {
    if (err instanceof BookingSubmitError) throw err;
    throw new BookingSubmitError(GENERIC_FAILURE); // network failure
  }
}
