import { Prisma, type PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { PrismaCatalogRepository } from "./prisma-catalog-repository";

function repoFailingWith(error: unknown): PrismaCatalogRepository {
  const fail = async () => {
    throw error;
  };
  return new PrismaCatalogRepository({ service: { update: fail }, bundle: { update: fail } } as unknown as PrismaClient);
}

const notFound = () => new Prisma.PrismaClientKnownRequestError("Record not found", { code: "P2025", clientVersion: "test" });

describe("PrismaCatalogRepository update error handling", () => {
  it("returns null when the row doesn't exist (P2025)", async () => {
    expect(await repoFailingWith(notFound()).updateService("x", { name: "n" })).toBeNull();
    expect(await repoFailingWith(notFound()).updateBundle("x", { name: "n" })).toBeNull();
  });

  it("rethrows any other error instead of reporting not found", async () => {
    const boom = new Error("connection lost");
    await expect(repoFailingWith(boom).updateService("x", { name: "n" })).rejects.toBe(boom);
    await expect(repoFailingWith(boom).updateBundle("x", { name: "n" })).rejects.toBe(boom);
  });
});
