import type { ItemStatus } from "@/features/orders/domain";

/** Status pill colours: where the pair is in the pipeline, always shown with its label. */
export const STATUS_TONE: Record<ItemStatus, string> = {
  REQUEST_SUBMITTED: "neutral",
  UNDER_REVIEW: "neutral",
  QUOTE_SENT: "amber",
  APPROVED: "amber",
  AWAITING_SNEAKERS: "amber",
  IN_PROGRESS: "blue",
  QUALITY_CHECK: "blue",
  READY_FOR_PICKUP_SHIPPING: "violet",
  COMPLETED: "green",
  CANCELLED: "muted",
};
