// Shared types for the booking flow, split across booking-flow.tsx and its
// step components (service-step, pair-form, details-step, schedule-step,
// review-step) so the step components don't need to import from each
// other for these. PickupSelection is the one exception — it stays in
// pickup-date-picker.tsx, which several of these still import it from.
export type FlowType = "single" | "bundle";
export type Step = "service" | "details" | "schedule" | "contact" | "review";
export type ScheduleMethod = "pickup" | "mail-in";
export type PairDetails = { brand: string; material: string; notes: string; photos: File[] };
export type PickupAddress = { address: string; apt: string; city: string; state: string; zip: string };
export type ContactInfo = { name: string; email: string; phone: string };

export const EMPTY_PAIR: PairDetails = { brand: "", material: "", notes: "", photos: [] };
export const EMPTY_ADDRESS: PickupAddress = { address: "", apt: "", city: "", state: "", zip: "" };
export const EMPTY_CONTACT: ContactInfo = { name: "", email: "", phone: "" };
