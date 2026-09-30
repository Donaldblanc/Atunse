import { shopClock } from "@/features/orders/calendar-date";

/** "Good morning" / "Good afternoon" / "Good evening" by the shop's (New York's) clock. */
export function greeting(now: Date): string {
  const hour = Math.floor(shopClock(now).minutes / 60);
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
