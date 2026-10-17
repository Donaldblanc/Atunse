import { Prisma, type PrismaClient } from "@prisma/client";
import type {
  BundleRecord,
  BundleUpdate,
  CatalogRepository,
  NewBundleInput,
  ServiceRecord,
  ServiceUpdate,
} from "./catalog-repository";
import { BundleIdTakenError, CatalogChangedError, CatalogImageKeyTakenError, CatalogImageNotFoundError, MAX_CATALOG_IMAGES, TooManyCatalogImagesError } from "./catalog-repository";

const serviceInclude = { images: { orderBy: { position: "asc" as const } } };
const bundleInclude = { images: { orderBy: { position: "asc" as const } } };

function toService(row: {
  id: string;
  name: string;
  description: string;
  category: string;
  isCleaningTier: boolean;
  isAddOn: boolean;
  baseCents: number;
  isMinimum: boolean;
  suedeFeeCents: number;
  minimumLabel: string | null;
  internalNotes: string | null;
  active: boolean;
  position: number;
  images: { id: string; key: string; position: number }[];
  createdAt: Date;
  updatedAt: Date;
}): ServiceRecord {
  return { ...row, category: row.category as ServiceRecord["category"] };
}

function toBundle(row: {
  id: string;
  name: string;
  priceCents: number;
  perks: string[];
  internalNotes: string | null;
  active: boolean;
  position: number;
  images: { id: string; key: string; position: number }[];
  createdAt: Date;
  updatedAt: Date;
}): BundleRecord {
  return { ...row };
}

function isPrismaError(err: unknown, code: string): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === code;
}

export class PrismaCatalogRepository implements CatalogRepository {
  constructor(private readonly db: PrismaClient) {}

  async listServices(): Promise<ServiceRecord[]> {
    const rows = await this.db.service.findMany({ include: serviceInclude, orderBy: { position: "asc" } });
    return rows.map(toService);
  }

  async listBundles(): Promise<BundleRecord[]> {
    const rows = await this.db.bundle.findMany({ include: bundleInclude, orderBy: { position: "asc" } });
    return rows.map(toBundle);
  }

  async getService(id: string): Promise<ServiceRecord | null> {
    const row = await this.db.service.findUnique({ where: { id }, include: serviceInclude });
    return row ? toService(row) : null;
  }

  async getBundle(id: string): Promise<BundleRecord | null> {
    const row = await this.db.bundle.findUnique({ where: { id }, include: bundleInclude });
    return row ? toBundle(row) : null;
  }

  async updateService(id: string, patch: ServiceUpdate, expectedUpdatedAt?: Date): Promise<ServiceRecord | null> {
    if (expectedUpdatedAt) {
      // Conditional on updatedAt: a save that landed since the form loaded makes count 0.
      const { count } = await this.db.service.updateMany({ where: { id, updatedAt: expectedUpdatedAt }, data: patch });
      if (count === 0) {
        if (!(await this.db.service.findUnique({ where: { id }, select: { id: true } }))) return null;
        throw new CatalogChangedError();
      }
      return this.getService(id);
    }
    try {
      const row = await this.db.service.update({ where: { id }, data: patch, include: serviceInclude });
      return toService(row);
    } catch (err) {
      if (isPrismaError(err, "P2025")) return null;
      throw err;
    }
  }

  async updateBundle(id: string, patch: BundleUpdate, expectedUpdatedAt?: Date): Promise<BundleRecord | null> {
    if (expectedUpdatedAt) {
      const { count } = await this.db.bundle.updateMany({ where: { id, updatedAt: expectedUpdatedAt }, data: patch });
      if (count === 0) {
        if (!(await this.db.bundle.findUnique({ where: { id }, select: { id: true } }))) return null;
        throw new CatalogChangedError();
      }
      return this.getBundle(id);
    }
    try {
      const row = await this.db.bundle.update({ where: { id }, data: patch, include: bundleInclude });
      return toBundle(row);
    } catch (err) {
      if (isPrismaError(err, "P2025")) return null;
      throw err;
    }
  }

  async createBundle(input: NewBundleInput): Promise<BundleRecord> {
    try {
      const row = await this.db.bundle.create({
        data: {
          id: input.id,
          name: input.name,
          priceCents: input.priceCents,
          perks: input.perks,
          internalNotes: input.internalNotes ?? null,
          position: input.position,
        },
        include: bundleInclude,
      });
      return toBundle(row);
    } catch (err) {
      // A double submit raced past the use-case's getBundle check.
      if (isPrismaError(err, "P2002")) throw new BundleIdTakenError(input.id);
      throw err;
    }
  }

  async addServiceImage(serviceId: string, key: string): Promise<ServiceRecord | null> {
    return this.db.$transaction(async (tx) => {
      const service = await tx.service.findUnique({ where: { id: serviceId }, include: serviceInclude });
      if (!service) return null;
      if (service.images.length >= MAX_CATALOG_IMAGES) throw new TooManyCatalogImagesError();
      const nextPosition = service.images.reduce((max, image) => Math.max(max, image.position), -1) + 1;
      try {
        await tx.serviceImage.create({ data: { serviceId, key, position: nextPosition } });
      } catch (err) {
        if (isPrismaError(err, "P2002")) throw new CatalogImageKeyTakenError(key);
        throw err;
      }
      const updated = await tx.service.findUniqueOrThrow({ where: { id: serviceId }, include: serviceInclude });
      return toService(updated);
    });
  }

  async addBundleImage(bundleId: string, key: string): Promise<BundleRecord | null> {
    return this.db.$transaction(async (tx) => {
      const bundle = await tx.bundle.findUnique({ where: { id: bundleId }, include: bundleInclude });
      if (!bundle) return null;
      if (bundle.images.length >= MAX_CATALOG_IMAGES) throw new TooManyCatalogImagesError();
      const nextPosition = bundle.images.reduce((max, image) => Math.max(max, image.position), -1) + 1;
      try {
        await tx.bundleImage.create({ data: { bundleId, key, position: nextPosition } });
      } catch (err) {
        if (isPrismaError(err, "P2002")) throw new CatalogImageKeyTakenError(key);
        throw err;
      }
      const updated = await tx.bundle.findUniqueOrThrow({ where: { id: bundleId }, include: bundleInclude });
      return toBundle(updated);
    });
  }

  async removeServiceImage(serviceId: string, imageId: string): Promise<ServiceRecord | null> {
    return this.db.$transaction(async (tx) => {
      const service = await tx.service.findUnique({ where: { id: serviceId }, include: serviceInclude });
      if (!service) return null;
      if (!service.images.some((image) => image.id === imageId)) throw new CatalogImageNotFoundError(imageId);
      await tx.serviceImage.delete({ where: { id: imageId } });
      const updated = await tx.service.findUniqueOrThrow({ where: { id: serviceId }, include: serviceInclude });
      return toService(updated);
    });
  }

  async removeBundleImage(bundleId: string, imageId: string): Promise<BundleRecord | null> {
    return this.db.$transaction(async (tx) => {
      const bundle = await tx.bundle.findUnique({ where: { id: bundleId }, include: bundleInclude });
      if (!bundle) return null;
      if (!bundle.images.some((image) => image.id === imageId)) throw new CatalogImageNotFoundError(imageId);
      await tx.bundleImage.delete({ where: { id: imageId } });
      const updated = await tx.bundle.findUniqueOrThrow({ where: { id: bundleId }, include: bundleInclude });
      return toBundle(updated);
    });
  }
}
