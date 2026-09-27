import { describe, expect, it } from "vitest";
import { EMPTY_ADDRESS, EMPTY_CONTACT } from "./booking-types";
import { BookingSubmitError, buildOrderRequestBody, submitBooking, type BookingSubmission } from "./submit-booking";

const photo = new File([new Uint8Array(4)], "shoe.jpg", { type: "image/jpeg" });

function submission(overrides: Partial<BookingSubmission> = {}): BookingSubmission {
  return {
    submissionKey: "3c1f0e2a-7d4b-4a8e-9f6c-1b2d3e4f5a6b",
    policyAccepted: true,
    serviceIds: ["standard"],
    pair: { brand: "Nike AF1", material: "Suede", notes: "", photos: [photo] },
    scheduleMethod: "pickup",
    address: { ...EMPTY_ADDRESS, address: "123 Main St", city: "New York", state: "NY", zip: "10001" },
    pickupSelection: { date: new Date(2026, 9, 3), time: "4:30 PM – 5:00 PM" },
    mailInDate: null,
    contact: { ...EMPTY_CONTACT, name: "Jordan", email: "j@example.com", phone: "2125550142" },
    rush: false,
    ...overrides,
  };
}

describe("buildOrderRequestBody", () => {
  it("sends the pickup date as the local calendar day and blanks as null", () => {
    const body = buildOrderRequestBody(submission(), ["k"]);
    expect(body.fulfillment).toEqual({
      method: "PICKUP",
      address: { line1: "123 Main St", line2: null, city: "New York", state: "NY", zip: "10001" },
      date: "2026-10-03",
      slot: "4:30 PM – 5:00 PM",
    });
    expect(body.item).toEqual({ brand: "Nike AF1", material: "Suede", notes: null, serviceIds: ["standard"], photoKeys: ["k"] });
  });

  it("sends Mail-In with an optional preferred date", () => {
    expect(buildOrderRequestBody(submission({ scheduleMethod: "mail-in", pickupSelection: null }), []).fulfillment).toMatchObject({
      method: "MAIL_IN",
      preferredDate: null,
    });
  });

  it("refuses a pickup with no date chosen", () => {
    expect(() => buildOrderRequestBody(submission({ pickupSelection: null }), [])).toThrow(BookingSubmitError);
  });
});

type Call = { url: string; init: RequestInit };

function fakeFetch(responses: Record<string, () => Response>) {
  const calls: Call[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const respond = responses[url];
    if (!respond) throw new TypeError("network down");
    return respond();
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const uploadsOk = () =>
  Response.json(
    { uploads: [{ key: "bookings/b/0.jpg", url: "https://bucket.test", fields: { key: "bookings/b/0.jpg", Policy: "p" } }] },
    { status: 201 },
  );

describe("submitBooking", () => {
  it("uploads photos to their targets, then submits the keys with the Idempotency-Key", async () => {
    const orderResponse = { order: { reference: "ABC12345" }, paymentInstructions: { zelle: null } };
    const { impl, calls } = fakeFetch({
      "/api/v1/uploads": uploadsOk,
      "https://bucket.test": () => new Response(null, { status: 204 }),
      "/api/v1/orders": () => Response.json(orderResponse, { status: 201 }),
    });

    const result = await submitBooking(submission(), new WeakMap(), impl);

    expect(result).toEqual(orderResponse);
    expect(calls.map((c) => c.url)).toEqual(["/api/v1/uploads", "https://bucket.test", "/api/v1/orders"]);
    const form = calls[1]!.init.body as FormData;
    expect([...form.keys()]).toEqual(["key", "Policy", "file"]); // file last, as S3 requires
    const orderCall = calls[2]!;
    expect((orderCall.init.headers as Record<string, string>)["Idempotency-Key"]).toBe(submission().submissionKey);
    expect(JSON.parse(orderCall.init.body as string).item.photoKeys).toEqual(["bookings/b/0.jpg"]);
  });

  it("surfaces the server's validation message", async () => {
    const { impl } = fakeFetch({
      "/api/v1/uploads": uploadsOk,
      "https://bucket.test": () => new Response(null, { status: 204 }),
      "/api/v1/orders": () => Response.json({ error: "Enter a valid 5-digit zip code." }, { status: 400 }),
    });
    await expect(submitBooking(submission(), new WeakMap(), impl)).rejects.toThrow("Enter a valid 5-digit zip code.");
  });

  it("passes the server's SIGN_IN_REQUIRED code through, so the flow can show the login screen", async () => {
    const { impl } = fakeFetch({
      "/api/v1/uploads": uploadsOk,
      "https://bucket.test": () => new Response(null, { status: 204 }),
      "/api/v1/orders": () =>
        Response.json({ error: "You already have an account with this email.", code: "SIGN_IN_REQUIRED" }, { status: 409 }),
    });
    await expect(submitBooking(submission(), new WeakMap(), impl)).rejects.toMatchObject({
      name: "BookingSubmitError",
      code: "SIGN_IN_REQUIRED",
    });
  });

  it("stops before submitting when a photo upload fails", async () => {
    const { impl, calls } = fakeFetch({
      "/api/v1/uploads": uploadsOk,
      "https://bucket.test": () => new Response(null, { status: 403 }),
    });
    await expect(submitBooking(submission(), new WeakMap(), impl)).rejects.toThrow(/photos didn't upload/);
    expect(calls.some((c) => c.url === "/api/v1/orders")).toBe(false);
  });

  it("turns a network failure into a friendly error", async () => {
    const { impl } = fakeFetch({});
    await expect(submitBooking(submission(), new WeakMap(), impl)).rejects.toThrow(BookingSubmitError);
  });
});

describe("retries reuse uploaded photos (#78)", () => {
  it("doesn't upload again when the order fails after the photos went up", async () => {
    let orderAttempts = 0;
    const { impl, calls } = fakeFetch({
      "/api/v1/uploads": uploadsOk,
      "https://bucket.test": () => new Response(null, { status: 204 }),
      "/api/v1/orders": () =>
        ++orderAttempts === 1
          ? Response.json({ error: "Something broke" }, { status: 500 })
          : Response.json({ order: { reference: "ABC12345" }, paymentInstructions: { zelle: null } }, { status: 201 }),
    });
    const uploaded = new WeakMap<File, string>();
    const booking = submission();

    await expect(submitBooking(booking, uploaded, impl)).rejects.toThrow(BookingSubmitError);
    await submitBooking(booking, uploaded, impl);

    expect(calls.filter((c) => c.url === "/api/v1/uploads")).toHaveLength(1);
    expect(calls.filter((c) => c.url === "https://bucket.test")).toHaveLength(1);
    const orderBodies = calls.filter((c) => c.url === "/api/v1/orders").map((c) => JSON.parse(c.init.body as string));
    expect(orderBodies[1].item.photoKeys).toEqual(orderBodies[0].item.photoKeys);
  });

  it("uploads only the photos that aren't in storage yet", async () => {
    const second = new File([new Uint8Array(4)], "side.jpg", { type: "image/jpeg" });
    const uploaded = new WeakMap<File, string>([[photo, "bookings/earlier/0.jpg"]]);
    const { impl, calls } = fakeFetch({
      "/api/v1/uploads": () =>
        Response.json({ uploads: [{ key: "bookings/b/0.jpg", url: "https://bucket.test", fields: { key: "bookings/b/0.jpg" } }] }, { status: 201 }),
      "https://bucket.test": () => new Response(null, { status: 204 }),
      "/api/v1/orders": () => Response.json({ order: {}, paymentInstructions: { zelle: null } }, { status: 201 }),
    });

    await submitBooking(submission({ pair: { ...submission().pair, photos: [photo, second] } }), uploaded, impl);

    expect(JSON.parse(calls[0]!.init.body as string).files).toHaveLength(1); // only side.jpg
    const order = JSON.parse(calls.find((c) => c.url === "/api/v1/orders")!.init.body as string);
    expect(order.item.photoKeys).toEqual(["bookings/earlier/0.jpg", "bookings/b/0.jpg"]);
  });

  it("doesn't remember a photo whose upload failed", async () => {
    const uploaded = new WeakMap<File, string>();
    const { impl } = fakeFetch({ "/api/v1/uploads": uploadsOk, "https://bucket.test": () => new Response(null, { status: 403 }) });
    await expect(submitBooking(submission(), uploaded, impl)).rejects.toThrow(BookingSubmitError);
    expect(uploaded.has(photo)).toBe(false);
  });
});

describe("server answers the booking flow acts on", () => {
  it("carries the existing booking with SUBMISSION_CONFLICT, so the flow can show it", async () => {
    const existing = { order: { reference: "ABC12345" }, paymentInstructions: { zelle: null } };
    const { impl } = fakeFetch({
      "/api/v1/uploads": uploadsOk,
      "https://bucket.test": () => new Response(null, { status: 204 }),
      "/api/v1/orders": () =>
        Response.json({ error: "We already received this booking.", code: "SUBMISSION_CONFLICT", existing }, { status: 409 }),
    });
    await expect(submitBooking(submission(), new WeakMap(), impl)).rejects.toMatchObject({
      code: "SUBMISSION_CONFLICT",
      existing,
    });
  });

  it("re-uploads once when the server says the remembered photos are already in use", async () => {
    let orderAttempts = 0;
    const { impl, calls } = fakeFetch({
      "/api/v1/uploads": uploadsOk,
      "https://bucket.test": () => new Response(null, { status: 204 }),
      "/api/v1/orders": () =>
        ++orderAttempts === 1
          ? Response.json({ error: "Already attached.", code: "PHOTOS_IN_USE" }, { status: 400 })
          : Response.json({ order: { reference: "NEW00001" }, paymentInstructions: { zelle: null } }, { status: 201 }),
    });
    const uploaded = new WeakMap<File, string>([[photo, "bookings/first-order/0.jpg"]]);

    const result = await submitBooking(submission(), uploaded, impl);

    expect(result.order.reference).toBe("NEW00001");
    expect(calls.filter((c) => c.url === "/api/v1/uploads")).toHaveLength(1); // only the retry uploads
    expect(uploaded.get(photo)).toBe("bookings/b/0.jpg");
  });
});
