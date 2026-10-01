// What admin screens show for a pair's photo. "No photo" and "a photo we
// couldn't show" look different on purpose: the first is normal (the
// customer uploaded none), the second means something's wrong (a missing
// file, a storage error, an expired link) and is worth a look.

/** None uploaded; or stored, with its view link (null when one couldn't be made). */
export type PairPhoto = { kind: "none" } | { kind: "stored"; url: string | null };

/** The PairPhoto for a pair's first photo key, if it has one. */
export async function pairPhoto(photoKey: string | undefined, photoUrl: (key: string) => Promise<string | null>): Promise<PairPhoto> {
  return photoKey ? { kind: "stored", url: await photoUrl(photoKey) } : { kind: "none" };
}
