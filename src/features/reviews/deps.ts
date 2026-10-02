import { prisma } from "@/shared/db/prisma-client";
import { PrismaReviewRepository } from "./repositories/prisma-review-repository";
import type { ReviewRepository } from "./repositories/review-repository";

export interface ReviewDeps {
  reviews: ReviewRepository;
  now: () => Date;
}

// The real (Prisma-backed) implementation (ADR-0003/0011); pages and actions import this, never Prisma.
export function buildReviewDeps(): ReviewDeps {
  return { reviews: new PrismaReviewRepository(prisma), now: () => new Date() };
}
