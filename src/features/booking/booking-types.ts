// Shared types for the booking flow, split across booking-flow.tsx and its
// step components (service-step, pair-form, details-step, schedule-step,
// review-step) so the step components don't need to import from each
// other for these. PickupSelection is the one exception — it stays in
// pickup-date-picker.tsx, which several of these still import it from.
export type FlowType = "single" | "bundle";
export type Step = "service" | "details" | "schedule" | "review";
export type ScheduleMethod = "pickup" | "mail-in";
export type PairDetails = { brand: string; material: string; notes: string };
export type PickupAddress = { address: string; apt: string; city: string; state: string; zip: string };

export const EMPTY_PAIR: PairDetails = { brand: "", material: "", notes: "" };
export const EMPTY_ADDRESS: PickupAddress = { address: "", apt: "", city: "", state: "", zip: "" };
