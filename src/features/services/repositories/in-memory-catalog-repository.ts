// Test double for the CatalogRepository seam, kept behaviourally identical
// to PrismaCatalogRepository.

import type { BundleRecord, BundleUpdate, CatalogImage, CatalogRepository, NewBundleInput, ServiceRecord, ServiceUpdate } from "./catalog-repository";
import { CatalogImageNotFoundError, MAX_CATALOG_IMAGES, TooManyCatalogImagesError } from "./catalog-repository";

let nextImageId = 0;
function fakeImageId(): string {
  nextImageId += 1;
  return `image_${nextImageId}`;
}

function addImage(images: CatalogImage[], key: string): CatalogImage[] {
  if (images.length >= MAX_CATALOG_IMAGES) throw new TooManyCatalogImagesError();
  const nextPosition = images.reduce((max, image) => Math.max(max, image.position), -1) + 1;
  return [...images, { id: fakeImageId(), key, position: nextPosition }];
}

function removeImage(images: CatalogImage[], imageId: string): CatalogImage[] {
  if (!images.some((image) => image.id === imageId)) throw new CatalogImageNotFoundError(imageId);
  return images.filter((image) => image.id !== imageId);
}

export class InMemoryCatalogRepository implements CatalogRepository {
  readonly services = new Map<string, ServiceRecord>();
  readonly bundles = new Map<string, BundleRecord>();

  async listServices(): Promise<ServiceRecord[]> {
    return [...this.services.values()].sort((a, b) => a.position - b.position);
  }

  async listBundles(): Promise<BundleRecord[]> {
    return [...this.bundles.values()].sort((a, b) => a.position - b.position);
  }

  async getService(id: string): Promise<ServiceRecord | null> {
    return this.services.get(id) ?? null;
  }

  async getBundle(id: string): Promise<BundleRecord | null> {
    return this.bundles.get(id) ?? null;
  }

  async updateService(id: string, patch: ServiceUpdate): Promise<ServiceRecord | null> {
    const existing = this.services.get(id);
    if (!existing) return null;
    const updated: ServiceRecord = { ...existing, ...patch, updatedAt: new Date() };
    this.services.set(id, updated);
    return updated;
  }

  async updateBundle(id: string, patch: BundleUpdate): Promise<BundleRecord | null> {
    const existing = this.bundles.get(id);
    if (!existing) return null;
    const updated: BundleRecord = { ...existing, ...patch, updatedAt: new Date() };
    this.bundles.set(id, updated);
    return updated;
  }

  async createBundle(input: NewBundleInput): Promise<BundleRecord> {
    const now = new Date();
    const bundle: BundleRecord = {
      id: input.id,
      name: input.name,
      priceCents: input.priceCents,
      perks: input.perks,
      internalNotes: input.internalNotes ?? null,
      active: true,
      position: input.position,
      images: [],
      createdAt: now,
      updatedAt: now,
    };
    this.bundles.set(bundle.id, bundle);
    return bundle;
  }

  async addServiceImage(serviceId: string, key: string): Promise<ServiceRecord | null> {
    const existing = this.services.get(serviceId);
    if (!existing) return null;
    const updated: ServiceRecord = { ...existing, images: addImage(existing.images, key), updatedAt: new Date() };
    this.services.set(serviceId, updated);
    return updated;
  }

  async addBundleImage(bundleId: string, key: string): Promise<BundleRecord | null> {
    const existing = this.bundles.get(bundleId);
    if (!existing) return null;
    const updated: BundleRecord = { ...existing, images: addImage(existing.images, key), updatedAt: new Date() };
    this.bundles.set(bundleId, updated);
    return updated;
  }

  async removeServiceImage(serviceId: string, imageId: string): Promise<ServiceRecord | null> {
    const existing = this.services.get(serviceId);
    if (!existing) return null;
    const updated: ServiceRecord = { ...existing, images: removeImage(existing.images, imageId), updatedAt: new Date() };
    this.services.set(serviceId, updated);
    return updated;
  }

  async removeBundleImage(bundleId: string, imageId: string): Promise<BundleRecord | null> {
    const existing = this.bundles.get(bundleId);
    if (!existing) return null;
    const updated: BundleRecord = { ...existing, images: removeImage(existing.images, imageId), updatedAt: new Date() };
    this.bundles.set(bundleId, updated);
    return updated;
  }
}
