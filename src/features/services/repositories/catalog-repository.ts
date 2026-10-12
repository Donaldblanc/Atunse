// The seam (ADR-0003/0011): use-cases depend on this interface, never on
// Prisma directly. See ./prisma-catalog-repository.ts for the real
// implementation and ./in-memory-catalog-repository.ts for unit tests.
//
// One repository for both Service and Bundle (admin's Services & Pricing
// screen shows both in one place; neither is complex enough alone to earn
// its own repository), the same shape `order-repository.ts` uses for
// Order/Item/Payment/Appointment together.

export type ServiceCategory = "CLEANING" | "RESTORATION" | "CUSTOM_WORK" | "ADDITIONAL";

export interface CatalogImage {
  id: string;
  key: string;
  position: number;
}

export interface ServiceRecord {
  id: string;
  name: string;
  description: string;
  category: ServiceCategory;
  isCleaningTier: boolean;
  isAddOn: boolean;
  baseCents: number;
  isMinimum: boolean;
  suedeFeeCents: number;
  minimumLabel: string | null;
  internalNotes: string | null;
  active: boolean;
  position: number;
  images: CatalogImage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface BundleRecord {
  id: string;
  name: string;
  priceCents: number;
  perks: string[];
  internalNotes: string | null;
  active: boolean;
  position: number;
  images: CatalogImage[];
  createdAt: Date;
  updatedAt: Date;
}

/** Edit Service's writable fields (everything the side panel can change). */
export interface ServiceUpdate {
  name?: string;
  description?: string;
  baseCents?: number;
  suedeFeeCents?: number;
  category?: ServiceCategory;
  active?: boolean;
  internalNotes?: string | null;
}

export interface BundleUpdate {
  name?: string;
  priceCents?: number;
  perks?: string[];
  active?: boolean;
  internalNotes?: string | null;
}

export interface NewBundleInput {
  id: string;
  name: string;
  priceCents: number;
  perks: string[];
  internalNotes?: string | null;
  position: number;
}

/** No Service has this id. Nothing was written. */
export class ServiceNotFoundError extends Error {
  constructor(readonly serviceId: string) {
    super("Service not found.");
    this.name = "ServiceNotFoundError";
  }
}

/** No Bundle has this id. Nothing was written. */
export class BundleNotFoundError extends Error {
  constructor(readonly bundleId: string) {
    super("Bundle not found.");
    this.name = "BundleNotFoundError";
  }
}

/** A Bundle with this id already exists (Add Bundle picked a slug in use). */
export class BundleIdTakenError extends Error {
  constructor(readonly bundleId: string) {
    super("A bundle with this id already exists.");
    this.name = "BundleIdTakenError";
  }
}

/** The image id a remove targeted isn't on that Service/Bundle. Nothing was written. */
export class CatalogImageNotFoundError extends Error {
  constructor(readonly imageId: string) {
    super("Image not found.");
    this.name = "CatalogImageNotFoundError";
  }
}

/** Up to MAX_CATALOG_IMAGES images per Service or Bundle (the design: "up to 5"). */
export const MAX_CATALOG_IMAGES = 5;

export class TooManyCatalogImagesError extends Error {
  constructor() {
    super(`A service or bundle can have at most ${MAX_CATALOG_IMAGES} images.`);
    this.name = "TooManyCatalogImagesError";
  }
}

export interface CatalogRepository {
  listServices(): Promise<ServiceRecord[]>;
  listBundles(): Promise<BundleRecord[]>;
  getService(id: string): Promise<ServiceRecord | null>;
  getBundle(id: string): Promise<BundleRecord | null>;

  /** Applies `patch`'s present fields in one write. Null if no Service has `id`. */
  updateService(id: string, patch: ServiceUpdate): Promise<ServiceRecord | null>;
  updateBundle(id: string, patch: BundleUpdate): Promise<BundleRecord | null>;

  createBundle(input: NewBundleInput): Promise<BundleRecord>;

  /**
   * Adds one image (by storage key) at the next position. Throws
   * TooManyCatalogImagesError past MAX_CATALOG_IMAGES. Null if no Service/
   * Bundle has that id.
   */
  addServiceImage(serviceId: string, key: string): Promise<ServiceRecord | null>;
  addBundleImage(bundleId: string, key: string): Promise<BundleRecord | null>;

  /** Throws CatalogImageNotFoundError if the image isn't on that Service/Bundle. Null if the Service/Bundle itself doesn't exist. */
  removeServiceImage(serviceId: string, imageId: string): Promise<ServiceRecord | null>;
  removeBundleImage(bundleId: string, imageId: string): Promise<BundleRecord | null>;
}
