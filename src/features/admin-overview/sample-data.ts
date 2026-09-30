// SAMPLE DATA, not real. Placeholder figures for the Overview sections
// that nothing in the app records yet, so the page reads like the design
// (scratch/overview-dashboard.jpeg). Everything here is shown with a
// "Sample" tag, and each export has an entry in docs/TODO.md ("Admin
// Overview: replace sample data") saying what real data replaces it.
// Delete each export once its real source exists.

/** TODO(sample-data): unread customer Messages (Conversation/Message, #119). */
export const SAMPLE_UNREAD_MESSAGES = 3;

/** TODO(sample-data): Inventory Items at or below their low-stock level (InventoryItem, #119). */
export const SAMPLE_LOW_STOCK_ITEMS = 3;

export interface SampleReview {
  name: string;
  /** 1-5. */
  rating: number;
  /** "YYYY-MM-DD". */
  date: string;
  text: string;
}

/** TODO(sample-data): customer reviews (no Review model or source yet). */
export const SAMPLE_REVIEWS: SampleReview[] = [
  {
    name: "John Doe",
    rating: 5,
    date: "2026-09-18",
    text: "Amazing work as always! My Jordans look brand new. Super fast turnaround too.",
  },
];
