import { describe, expect, it } from "vitest";
import { UnauthorizedError } from "@/features/accounts/authz";
import { orderNumber, pairsPhrase } from "../domain";
import { BUNDLE_PAIR_SERVICE_IDS } from "../service-catalog";
import {
  BookingValidationError,
  PolicyNotAcceptedError,
  SignInRequiredError,
  SubmissionConflictError,
  submitOrder,
} from "./submit-order";
import { JPEG_BYTES } from "@/shared/storage/in-memory-file-storage";
import { TERMS_AGREEMENT } from "@/shared/legal-documents";
import { bookingDeps, FIXED_NOW, validBookingInput, validBundleInput, validPair } from "./test-fixtures";

const guest = { accountId: null, role: "GUEST" as const };
const mailInAddress = { line1: "1 Elm St", line2: null, city: "Austin", state: "TX", zip: "73301" };

describe("submitOrder", () => {
  it("creates an order with one REQUEST_SUBMITTED item as a guest", async () => {
    const order = await submitOrder(bookingDeps(), guest, validBookingInput());
    expect(order.items).toHaveLength(1);
    expect(order.items[0]?.status).toBe("REQUEST_SUBMITTED");
    expect(order.items[0]?.brand).toBe("Nike Air Force 1");
    expect(order.items[0]?.description).toBe("scuffed toe box");
    expect(order.contactName).toBe("Jordan Smith");
  });

  it("rejects submission without policy acceptance", async () => {
    await expect(submitOrder(bookingDeps(), guest, validBookingInput({ policyAccepted: false }))).rejects.toThrow(
      PolicyNotAcceptedError,
    );
  });

  it.each([
    ["none", []],
    ["only some", ["pricing", "restorationResults"]],
    ["unknown ids", ["pricing", "restorationResults", "materialRisks", "something-else"]],
  ])("rejects a booking that acknowledged %s of the risks, even with the Terms Agreement ticked", async (_label, acknowledgedTerms) => {
    const deps = bookingDeps();
    await expect(submitOrder(deps, guest, validBookingInput({ acknowledgedTerms }))).rejects.toThrow(PolicyNotAcceptedError);
    await expect(submitOrder(deps, guest, validBookingInput({ acknowledgedTerms }))).rejects.toThrow("Reload the page");
  });

  it.each([
    ["an older agreement version", "2026-01-01-v0"],
    ["no version (a tab from before versions were sent)", ""],
  ])("rejects a booking that accepted %s", async (_label, termsVersion) => {
    await expect(submitOrder(bookingDeps(), guest, validBookingInput({ termsVersion }))).rejects.toThrow(PolicyNotAcceptedError);
  });

  it("records exactly which agreement was accepted, when, and each acknowledgment (ADR-0015)", async () => {
    const order = await submitOrder(bookingDeps(), guest, validBookingInput());
    expect(order.termsAcceptance).toEqual({
      version: TERMS_AGREEMENT.version,
      url: TERMS_AGREEMENT.href,
      sha256: TERMS_AGREEMENT.sha256,
      acceptedAt: FIXED_NOW,
      acknowledgments: { pricing: true, restorationResults: true, materialRisks: true, structuralLimitations: true },
    });
    expect(order.policyAcceptedAt).toEqual(FIXED_NOW);
  });

  it("tells the customer in the confirmation email which agreement version they accepted", async () => {
    const deps = bookingDeps();
    await submitOrder(deps, guest, validBookingInput());
    expect(deps.notifications.sent[0]!.body).toContain(`${TERMS_AGREEMENT.title} (version ${TERMS_AGREEMENT.version})`);
  });

  it("rejects an admin trying to submit an order as themselves", async () => {
    await expect(submitOrder(bookingDeps(), { accountId: "acc_1", role: "ADMIN" }, validBookingInput())).rejects.toThrow(
      UnauthorizedError,
    );
  });

  describe("account ownership (ADR-0014)", () => {
    const secondPhoto = (input: ReturnType<typeof validBookingInput>) => {
      input.items = [{ ...input.items[0]!, photoKeys: ["bookings/0b6e8c1e-3f7a-4c2d-9e1b-5a4f3c2d1e0f/1.jpg"] }];
      return input;
    };

    it("creates a Customer Account for a new email, stored lowercased", async () => {
      const deps = bookingDeps();
      const input = validBookingInput({ contact: { name: "Jordan", email: "Jordan@Example.com", phone: "2125550142" } });
      const order = await submitOrder(deps, guest, input);

      expect(await deps.accounts.findCustomerByEmail("jordan@example.com")).toEqual({
        id: order.accountId,
        email: "jordan@example.com",
      });
      expect(order.contactEmail).toBe("Jordan@Example.com");
    });

    it("with customer login ON, asks a signed-out booking with a registered email to sign in, creating nothing", async () => {
      const deps = bookingDeps({ customerSignInEnabled: true });
      await submitOrder(deps, guest, validBookingInput());

      const again = secondPhoto(validBookingInput({ contact: { name: "Other", email: "CUSTOMER@example.com", phone: "2125550199" } }));
      await expect(submitOrder(deps, guest, again)).rejects.toThrow(SignInRequiredError);
      expect(deps.orders.orders.size).toBe(1);
    });

    it("with customer login OFF, attaches a registered email's booking to that Account", async () => {
      const deps = bookingDeps({ customerSignInEnabled: false });
      const first = await submitOrder(deps, guest, validBookingInput());
      const second = await submitOrder(deps, guest, secondPhoto(validBookingInput()));
      expect(second.accountId).toBe(first.accountId);
      expect(deps.orders.orders.size).toBe(2);
    });

    it.each([true, false])(
      "books an admin's email into a separate Customer Account, never the Admin Account (login %s)",
      async (customerSignInEnabled) => {
        const deps = bookingDeps({ customerSignInEnabled });
        const admin = deps.accounts.add({ role: "ADMIN", email: "owner@restoredbydj.com" });

        const order = await submitOrder(
          deps,
          guest,
          validBookingInput({ contact: { name: "DJ", email: "Owner@RestoredByDJ.com", phone: "2125550100" } }),
        );
        expect(order.accountId).not.toBe(admin.id);
        expect(deps.accounts.accounts.find((a) => a.id === order.accountId)).toMatchObject({
          role: "CUSTOMER",
          email: "owner@restoredbydj.com",
        });
      },
    );

    it("books a signed-in customer into their own Account when the email is theirs", async () => {
      const deps = bookingDeps({ customerSignInEnabled: true });
      const first = await submitOrder(deps, guest, validBookingInput());
      const customer = { accountId: first.accountId, role: "CUSTOMER" as const };

      const second = await submitOrder(deps, customer, secondPhoto(validBookingInput()));
      expect(second.accountId).toBe(first.accountId);
    });

    it("ignores a signed-in session when the booking is under someone else's email (shared browser)", async () => {
      const deps = bookingDeps({ customerSignInEnabled: true });
      const first = await submitOrder(deps, guest, validBookingInput());
      const customer = { accountId: first.accountId, role: "CUSTOMER" as const };

      const friend = secondPhoto(validBookingInput({ contact: { name: "Friend", email: "friend@example.com", phone: "2125550177" } }));
      const second = await submitOrder(deps, customer, friend);
      expect(second.accountId).not.toBe(first.accountId);
      expect((await deps.accounts.findCustomerByEmail("friend@example.com"))?.id).toBe(second.accountId);
    });

    it("recovers when a concurrent first booking takes the email between lookup and insert", async () => {
      const deps = bookingDeps({ customerSignInEnabled: false });
      // The lookup says "new", but the account appears before the insert.
      const lookup = deps.accounts.findCustomerByEmail.bind(deps.accounts);
      let calls = 0;
      deps.accounts.findCustomerByEmail = async (email) => {
        calls += 1;
        if (calls === 1) {
          deps.accounts.add({ role: "CUSTOMER", email });
          return null;
        }
        return lookup(email);
      };

      const order = await submitOrder(deps, guest, validBookingInput());
      expect(order.accountId).toBe((await lookup("customer@example.com"))?.id);
      expect(deps.accounts.accounts.filter((a) => a.email === "customer@example.com")).toHaveLength(1);
    });

    it("refuses photo keys already attached to another booking", async () => {
      const deps = bookingDeps();
      await submitOrder(deps, guest, validBookingInput());

      const stolen = validBookingInput({ contact: { name: "Eve", email: "eve@example.com", phone: "2125550100" } });
      await expect(submitOrder(deps, guest, stolen)).rejects.toThrow(/already attached to another booking/);
      await expect(submitOrder(deps, guest, stolen)).rejects.toMatchObject({ code: "PHOTOS_IN_USE" });
    });
  });

  describe("pricing", () => {
    it("computes the estimate and 50% Deposit from the server catalog, with Suede and Rush", async () => {
      const input = validBookingInput({ rush: true });
      input.items = [{ ...input.items[0]!, material: "Suede", serviceIds: ["standard", "oxidation"] }];
      const order = await submitOrder(bookingDeps(), guest, input);

      // 30 standard + 25 oxidation + 10 suede = 65 per pair; + 20 rush = 85
      expect(order.items[0]?.estimate.cents).toBe(6500);
      expect(order.estimate.cents).toBe(8500);
      expect(order.estimateIsMinimum).toBe(true);
      expect(order.deposit.cents).toBe(4250);
    });

    it("rejects invalid Service selections as a booking validation error", async () => {
      const input = validBookingInput();
      input.items = [{ ...input.items[0]!, serviceIds: ["standard", "premium"] }];
      await expect(submitOrder(bookingDeps(), guest, input)).rejects.toThrow(BookingValidationError);
    });

    it("adds a pair's Add-ons to its estimate and keeps them on the Item", async () => {
      const input = validBookingInput();
      input.items = [{ ...input.items[0]!, serviceIds: ["premium", "laces", "waterproofing"] }];
      const order = await submitOrder(bookingDeps(), guest, input);
      expect(order.items[0]!.serviceIds).toEqual(["premium", "laces", "waterproofing"]);
      expect(order.estimate.cents).toBe(5000 + 1500 + 500);
      expect(order.deposit.cents).toBe(3500);
    });

    it("refuses Add-ons booked on their own", async () => {
      const input = validBookingInput();
      input.items = [{ ...input.items[0]!, serviceIds: ["laces"] }];
      await expect(submitOrder(bookingDeps(), guest, input)).rejects.toThrow("Add-ons go with a cleaning or restoration service");
    });

    it("rejects an unknown material", async () => {
      const input = validBookingInput();
      input.items = [{ ...input.items[0]!, material: "Velvet" }];
      await expect(submitOrder(bookingDeps(), guest, input)).rejects.toThrow(BookingValidationError);
    });
  });

  describe("photos", () => {
    it.each([
      ["no photos", []],
      ["a key the server didn't mint", ["../../etc/passwd"]],
      ["too many photos", Array.from({ length: 11 }, (_, i) => `bookings/0b6e8c1e-3f7a-4c2d-9e1b-5a4f3c2d1e0f/${i}.jpg`)],
    ])("rejects %s", async (_label, photoKeys) => {
      const input = validBookingInput();
      input.items = [{ ...input.items[0]!, photoKeys }];
      await expect(submitOrder(bookingDeps(), guest, input)).rejects.toThrow(BookingValidationError);
    });
  });

  describe("uploaded photo verification (#77)", () => {
    const uploadKey = "bookings/9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d/0.jpg";
    const withPhoto = (key: string) => {
      const input = validBookingInput();
      input.items = [{ ...input.items[0]!, photoKeys: [key] }];
      return input;
    };

    it("refuses a photo key with nothing uploaded behind it, with a code telling the client to re-upload", async () => {
      const deps = bookingDeps();
      const attempt = submitOrder(deps, guest, withPhoto(uploadKey));
      await expect(attempt).rejects.toThrow(/didn't finish uploading/);
      await expect(attempt).rejects.toMatchObject({ code: "PHOTOS_NOT_UPLOADED" });
      expect(deps.orders.orders.size).toBe(0);
    });

    it("refuses bytes that aren't the image type the key promises", async () => {
      const deps = bookingDeps();
      deps.storage.put(uploadKey, new TextEncoder().encode("<html>not a photo</html>"), "image/jpeg");
      await expect(submitOrder(deps, guest, withPhoto(uploadKey))).rejects.toThrow(/aren't valid/);
      expect(deps.orders.orders.size).toBe(0);
    });

    it("refuses a stored Content-Type that isn't the key's image type, even with image bytes", async () => {
      const deps = bookingDeps();
      deps.storage.put(uploadKey, JPEG_BYTES, "text/html");
      await expect(submitOrder(deps, guest, withPhoto(uploadKey))).rejects.toThrow(/aren't valid/);
    });

    it("keeps a verified copy the upload target can't reach, so overwriting the upload afterwards changes nothing", async () => {
      const deps = bookingDeps();
      deps.storage.put(uploadKey);
      const order = await submitOrder(deps, guest, withPhoto(uploadKey));

      const [storedKey] = order.items[0]!.photoKeys;
      expect(storedKey).toMatch(/^photos\/[0-9a-f-]{36}\/0\.jpg$/);
      // The upload target is still valid for a few minutes: swap the bytes.
      deps.storage.put(uploadKey, new TextEncoder().encode("<html>swapped</html>"), "image/jpeg");
      expect(deps.storage.objects.get(storedKey!)?.bytes).toEqual(JPEG_BYTES);
    });
  });

  describe("fulfillment", () => {
    it("rejects Pickup outside NY/NJ/CT", async () => {
      const input = validBookingInput({
        fulfillment: { method: "PICKUP", address: mailInAddress, date: "2026-10-03", slot: "4:30 PM – 5:00 PM" },
      });
      await expect(submitOrder(bookingDeps(), guest, input)).rejects.toThrow(/only available in NY, NJ and CT/);
    });

    it("rejects a pickup date in the past (New York time) but accepts today", async () => {
      const base = validBookingInput().fulfillment;
      if (base.method !== "PICKUP") throw new Error("fixture must be a pickup");
      await expect(
        submitOrder(bookingDeps(), guest, validBookingInput({ fulfillment: { ...base, date: "2026-09-30" } })),
      ).rejects.toThrow(BookingValidationError);
      await expect(
        submitOrder(bookingDeps(), guest, validBookingInput({ fulfillment: { ...base, date: "2026-10-01" } })),
      ).resolves.toBeDefined();
    });

    it("rejects an impossible date and a slot outside the pickup window", async () => {
      const base = validBookingInput().fulfillment;
      if (base.method !== "PICKUP") throw new Error("fixture must be a pickup");
      await expect(
        submitOrder(bookingDeps(), guest, validBookingInput({ fulfillment: { ...base, date: "2026-02-30" } })),
      ).rejects.toThrow(BookingValidationError);
      await expect(
        submitOrder(bookingDeps(), guest, validBookingInput({ fulfillment: { ...base, slot: "7:30 AM – 8:00 AM" } })),
      ).rejects.toThrow(BookingValidationError);
    });

    it("rejects a same-day pickup slot that has passed or is under 2 hours away (#75)", async () => {
      const base = validBookingInput().fulfillment;
      if (base.method !== "PICKUP") throw new Error("fixture must be a pickup");
      const at = (iso: string) => bookingDeps({ now: () => new Date(iso) });

      // 9:45 PM EDT: today's 4:30 PM slot is long gone.
      await expect(
        submitOrder(at("2026-10-02T01:45:00Z"), guest, validBookingInput({ fulfillment: { ...base, date: "2026-10-01" } })),
      ).rejects.toThrow(/no longer available/);
      // 3:00 PM EDT: 4:30 PM is only 1.5 hours away, 5:00 PM is exactly 2.
      await expect(
        submitOrder(at("2026-10-01T19:00:00Z"), guest, validBookingInput({ fulfillment: { ...base, date: "2026-10-01" } })),
      ).rejects.toThrow(/no longer available/);
      await expect(
        submitOrder(
          at("2026-10-01T19:00:00Z"),
          guest,
          validBookingInput({ fulfillment: { ...base, date: "2026-10-01", slot: "5:00 PM – 5:30 PM" } }),
        ),
      ).resolves.toBeDefined();
    });

    it("judges 'today' by New York's date, not the customer's (#75)", async () => {
      const mailIn = (preferredDate: string) =>
        validBookingInput({ fulfillment: { method: "MAIL_IN", address: mailInAddress, preferredDate } });
      // 12:30 AM Oct 2 in New York = 9:30 PM Oct 1 in California: Oct 1 is past.
      const pastMidnight = bookingDeps({ now: () => new Date("2026-10-02T04:30:00Z") });
      await expect(submitOrder(pastMidnight, guest, mailIn("2026-10-01"))).rejects.toThrow(/from today onward/);
      // 11:30 PM Oct 1 in New York (already Oct 2 in UTC): Oct 1 is still today.
      const lateNight = bookingDeps({ now: () => new Date("2026-10-02T03:30:00Z") });
      await expect(submitOrder(lateNight, guest, mailIn("2026-10-01"))).resolves.toBeDefined();
    });

    it("accepts a nationwide Mail-In order with no preferred date", async () => {
      const input = validBookingInput({ fulfillment: { method: "MAIL_IN", address: mailInAddress, preferredDate: null } });
      const order = await submitOrder(bookingDeps(), guest, input);
      expect(order.fulfillment).toEqual({ method: "MAIL_IN", address: mailInAddress, preferredDate: null });
    });

    it("rejects a malformed zip", async () => {
      const input = validBookingInput({
        fulfillment: { method: "MAIL_IN", address: { ...mailInAddress, zip: "7330" }, preferredDate: null },
      });
      await expect(submitOrder(bookingDeps(), guest, input)).rejects.toThrow(BookingValidationError);
    });
  });

  describe("contact", () => {
    it.each([
      ["a blank name", { name: "  ", email: "a@b.co", phone: "2125550142" }],
      ["a malformed email", { name: "J", email: "not-an-email", phone: "2125550142" }],
      ["a short phone", { name: "J", email: "a@b.co", phone: "555-0142" }],
    ])("rejects %s", async (_label, contact) => {
      await expect(submitOrder(bookingDeps(), guest, validBookingInput({ contact }))).rejects.toThrow(
        BookingValidationError,
      );
    });
  });

  describe("notification and idempotency", () => {
    it("emails the customer their reference, Deposit and Zelle instructions", async () => {
      const deps = bookingDeps();
      const order = await submitOrder(deps, guest, validBookingInput());

      expect(deps.notifications.sent).toHaveLength(1);
      const email = deps.notifications.sent[0]!;
      expect(email.to).toBe("customer@example.com");
      expect(email.subject).toContain(orderNumber(order.number));
      expect(email.subject).toMatch(/ATU-\d{4}/);
      expect(email.body).toContain("Deposit due: $15");
      expect(email.body).toContain("pay@restoredbydj.com");
    });

    it("says instructions will follow when no Zelle recipient is configured", async () => {
      const deps = bookingDeps({ paymentInstructions: { zelle: null } });
      await submitOrder(deps, guest, validBookingInput());
      expect(deps.notifications.sent[0]?.body).toContain("We'll email you how to pay");
    });

    it("returns the same order and sends no second email for a retried submission key", async () => {
      const deps = bookingDeps();
      const input = validBookingInput({ submissionKey: "3c1f0e2a-7d4b-4a8e-9f6c-1b2d3e4f5a6b" });
      const first = await submitOrder(deps, guest, input);
      const retry = await submitOrder(deps, guest, input);

      expect(retry.id).toBe(first.id);
      expect(deps.orders.orders.size).toBe(1);
      expect(deps.notifications.sent).toHaveLength(1);
    });

    it("refuses a reused submission key whose booking details changed, naming the booking received (#76)", async () => {
      const deps = bookingDeps();
      const key = "5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b";
      const first = await submitOrder(deps, guest, validBookingInput({ submissionKey: key }));

      const edited = validBookingInput({ submissionKey: key, rush: true });
      const attempt = submitOrder(deps, guest, edited);
      await expect(attempt).rejects.toThrow(SubmissionConflictError);
      await expect(attempt).rejects.toMatchObject({ reference: orderNumber(first.number) });
      expect(deps.orders.orders.size).toBe(1);
    });

    it("sends the pending confirmation before refusing an edited retry, since the 409 says to check email", async () => {
      const deps = bookingDeps();
      const key = "7b8c9d0e-1f2a-4b3c-8d4e-5f6a7b8c9d0e";
      deps.notifications.failing = true;
      await expect(submitOrder(deps, guest, validBookingInput({ submissionKey: key }))).rejects.toThrow(/email provider/);
      expect(deps.notifications.sent).toHaveLength(0);

      deps.notifications.failing = false;
      const edited = (phone: string) =>
        submitOrder(deps, guest, validBookingInput({ submissionKey: key, contact: { name: "Jordan", email: "customer@example.com", phone } }));
      for (const phone of ["2125550100", "2125550101", "2125550102"]) {
        await expect(edited(phone)).rejects.toThrow(SubmissionConflictError);
      }
      expect(deps.notifications.sent).toHaveLength(1); // sent once, on the first edited retry
      await expect(edited("2125550103")).rejects.toMatchObject({ existing: { id: [...deps.orders.orders.keys()][0] } });
    });

    it("does the same when a concurrent request with the key won the race", async () => {
      const deps = bookingDeps();
      const key = "8c9d0e1f-2a3b-4c4d-9e5f-6a7b8c9d0e1f";
      deps.notifications.failing = true;
      await submitOrder(deps, guest, validBookingInput({ submissionKey: key })).catch(() => undefined);
      deps.notifications.failing = false;
      // The up-front lookup misses (the other request hadn't committed yet); create() then finds it.
      const lookup = deps.orders.findBySubmissionKey.bind(deps.orders);
      let lookups = 0;
      deps.orders.findBySubmissionKey = async (k) => (++lookups === 1 ? null : lookup(k));
      await expect(submitOrder(deps, guest, validBookingInput({ submissionKey: key, rush: true }))).rejects.toThrow(
        SubmissionConflictError,
      );
      expect(deps.notifications.sent).toHaveLength(1);
    });

    it("returns the Order for an identical retry even after its pickup date has passed (#76)", async () => {
      const deps = bookingDeps();
      const key = "6f7a8b9c-0d1e-4f2a-9b3c-4d5e6f7a8b9c";
      const input = validBookingInput({ submissionKey: key }); // pickup Oct 3
      const first = await submitOrder(deps, guest, input);

      const weekLater = { ...deps, now: () => new Date("2026-10-08T15:00:00Z") };
      const retry = await submitOrder(weekLater, guest, input);
      expect(retry.id).toBe(first.id);
    });

    it("sends the email on retry when the first send failed after the order was created", async () => {
      const deps = bookingDeps();
      const input = validBookingInput({ submissionKey: "7a2e9c41-5b3d-4f6a-8e1c-2d4b6f8a0c3e" });

      deps.notifications.failing = true;
      await expect(submitOrder(deps, guest, input)).rejects.toThrow("email provider unavailable");
      expect(deps.orders.orders.size).toBe(1);
      expect([...deps.orders.orders.values()][0]?.confirmationEmailSentAt).toBeNull();

      deps.notifications.failing = false;
      const retry = await submitOrder(deps, guest, input);
      expect(deps.orders.orders.size).toBe(1);
      expect(deps.notifications.sent).toHaveLength(1);
      expect(retry.confirmationEmailSentAt).toEqual(FIXED_NOW);

      await submitOrder(deps, guest, input);
      expect(deps.notifications.sent).toHaveLength(1);
    });
  });

  describe("Bundles (three pairs, one Order)", () => {
    it("books three Items, each Premium Clean, recording the Bundle and keeping the pairs in order", async () => {
      const input = validBundleInput("revival");
      input.items = input.items.map((pair, i) => ({ ...pair, brand: `Pair ${i + 1}` }));
      const order = await submitOrder(bookingDeps(), guest, input);

      expect(order.bundleId).toBe("revival");
      expect(order.items.map((item) => item.brand)).toEqual(["Pair 1", "Pair 2", "Pair 3"]);
      expect(order.items.every((item) => item.serviceIds.join() === "premium")).toBe(true);
      expect(order.items.map((item) => item.estimate.cents)).toEqual([5000, 5000, 5000]);
      expect(order.estimate.cents).toBe(15000);
      expect(order.estimateIsMinimum).toBe(false);
      expect(order.deposit.cents).toBe(7500);
    });

    it("splits a price that doesn't divide by three with the leftover cent on the first pair", async () => {
      const order = await submitOrder(bookingDeps(), guest, validBundleInput("restoration"));
      expect(order.items.map((item) => item.estimate.cents)).toEqual([5834, 5833, 5833]);
      expect(order.estimate.cents).toBe(17500);
      expect(order.deposit.cents).toBe(8750);
    });

    it("waives the Suede Fee and adds Rush once", async () => {
      const input = validBundleInput("collector", { rush: true });
      input.items = input.items.map((pair) => ({ ...pair, material: "Suede" }));
      const order = await submitOrder(bookingDeps(), guest, input);
      expect(order.estimate.cents).toBe(20000 + 2000);
    });

    it("gives each pair its own Add-ons on top of its share of the Bundle", async () => {
      const input = validBundleInput("revival");
      input.items = input.items.map((pair, i) => ({ ...pair, serviceIds: [[], ["laces"], ["deodorizing", "waterproofing"]][i]! }));
      const order = await submitOrder(bookingDeps(), guest, input);
      expect(order.items.map((item) => item.serviceIds)).toEqual([
        ["premium"],
        ["premium", "laces"],
        ["premium", "deodorizing", "waterproofing"],
      ]);
      expect(order.items.map((item) => item.estimate.cents)).toEqual([5000, 6500, 6500]);
      expect(order.estimate.cents).toBe(15000 + 1500 + 1000 + 500);
      expect(order.deposit.cents).toBe(9000);
    });

    it("keeps each pair's photos with that pair, each as its own verified copy", async () => {
      const order = await submitOrder(bookingDeps(), guest, validBundleInput());
      const keys = order.items.map((item) => item.photoKeys);
      expect(keys.every((pairKeys) => pairKeys.length === 1 && pairKeys[0]!.startsWith("photos/"))).toBe(true);
      expect(new Set(keys.flat()).size).toBe(3);
    });

    it("names the Bundle and all the pairs in the confirmation email", async () => {
      const deps = bookingDeps();
      await submitOrder(deps, guest, validBundleInput("revival"));
      expect(deps.notifications.sent[0]!.body).toContain("The Revival Pack");
      expect(deps.notifications.sent[0]!.body).toContain("your 3 pairs");
    });

    it.each([
      ["two pairs", () => validBundleInput("revival", { items: [validPair({ serviceIds: [] }, 0), validPair({ serviceIds: [] }, 1)] })],
      ["an unknown Bundle", () => validBundleInput("mystery")],
      ["Services other than Add-ons chosen per pair", () => validBundleInput("revival", { items: [0, 1, 2].map((i) => validPair({}, i)) })],
      ["the same photo on two pairs", () => validBundleInput("revival", { items: [0, 0, 1].map((i) => validPair({ serviceIds: [] }, i)) })],
      ["three pairs without a Bundle", () => validBookingInput({ items: [0, 1, 2].map((i) => validPair({}, i)) })],
    ])("rejects %s", async (_label, input) => {
      await expect(submitOrder(bookingDeps(), guest, input())).rejects.toThrow(BookingValidationError);
    });

    it("says which pair is missing its photos", async () => {
      const input = validBundleInput();
      input.items = [input.items[0]!, { ...input.items[1]!, photoKeys: [] }, input.items[2]!];
      await expect(submitOrder(bookingDeps(), guest, input)).rejects.toThrow("Add at least one photo of pair 2.");
    });
  });

  describe("Bundle review fixes (#85)", () => {
    it("gives each Bundle Item its own services array, never the catalog constant", async () => {
      const order = await submitOrder(bookingDeps(), guest, validBundleInput("revival"));
      const [a, b, c] = order.items.map((item) => item.serviceIds);
      expect(a).toEqual(["premium"]);
      expect(a).not.toBe(b);
      expect(b).not.toBe(c);
      expect(a).not.toBe(BUNDLE_PAIR_SERVICE_IDS);
    });

    it("never has more than 10 storage calls in flight for a 30-photo Bundle", async () => {
      const deps = bookingDeps();
      const keys = Array.from({ length: 30 }, (_, i) => `bookings/5a4f3c2d-1e0f-4a8b-9c7d-6e5f4a3b2c1d/${i}.jpg`);
      for (const key of keys) deps.storage.put(key);
      let inFlight = 0;
      let peak = 0;
      const track = <T>(call: () => Promise<T>) => async () => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await new Promise((r) => setTimeout(r, 1));
        try {
          return await call();
        } finally {
          inFlight -= 1;
        }
      };
      const { copy, inspect } = deps.storage;
      deps.storage.copy = (from, to) => track(() => copy.call(deps.storage, from, to))();
      deps.storage.inspect = (key) => track(() => inspect.call(deps.storage, key))();

      const input = validBundleInput("revival");
      input.items = input.items.map((item, pair) => ({ ...item, photoKeys: keys.slice(pair * 10, pair * 10 + 10) }));
      const order = await submitOrder(deps, guest, input);

      expect(order.items.flatMap((item) => item.photoKeys)).toHaveLength(30);
      expect(peak).toBeLessThanOrEqual(10);
    });

    it("words the pairs the same way everywhere", () => {
      expect(pairsPhrase(1)).toBe("your pair");
      expect(pairsPhrase(3)).toBe("your 3 pairs");
    });
  });
});
