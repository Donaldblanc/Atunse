// Browser side of "Confirm Booking": uploads the pair's photos straight to
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
  serviceIds: string[];
  pair: PairDetails;
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
  ) {
    super(message);
    this.name = "BookingSubmitError";
  }
}

const GENERIC_FAILURE = "Something went wrong submitting your booking. Please try again.";

export function buildOrderRequestBody(submission: BookingSubmission, photoKeys: string[]) {
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
    if (!submission.pickupSelection) throw new BookingSubmitError("Choose a pickup date and time.");
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
    contact: submission.contact,
    fulfillment,
    rush: submission.rush,
    item: {
      brand: submission.pair.brand || null,
      material: submission.pair.material || null,
      notes: submission.pair.notes || null,
      serviceIds: submission.serviceIds,
      photoKeys,
    },
  };
}

async function errorFrom(res: Response): Promise<BookingSubmitError> {
  try {
    const body = (await res.json()) as { error?: unknown; code?: unknown };
    return new BookingSubmitError(
      typeof body.error === "string" ? body.error : GENERIC_FAILURE,
      typeof body.code === "string" ? body.code : undefined,
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

  try {
    const photoKeys = await uploadPhotos(submission.pair.photos, uploaded, fetchImpl);
    const res = await fetchImpl("/api/v1/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": submission.submissionKey },
      body: JSON.stringify(buildOrderRequestBody(submission, photoKeys)),
    });
    if (!res.ok) throw await errorFrom(res);
    return (await res.json()) as SubmitOrderResponse;
  } catch (err) {
    if (err instanceof BookingSubmitError) throw err;
    throw new BookingSubmitError(GENERIC_FAILURE); // network failure
  }
}
