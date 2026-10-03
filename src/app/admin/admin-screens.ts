// Every admin screen from the design (scratch/01-09 images), in sidebar
// order. `built` flips to true as each screen ships: until then the
// sidebar shows it as coming soon and nothing links to its route, so the
// admin never lands on a 404.

import {
  CalendarBlankIcon,
  ChatCenteredTextIcon,
  ClipboardTextIcon,
  CreditCardIcon,
  GearSixIcon,
  HouseIcon,
  PackageIcon,
  StarIcon,
  TagIcon,
  UserIcon,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";

export type AdminScreenId =
  | "overview"
  | "orders"
  | "calendar"
  | "customers"
  | "services"
  | "inventory"
  | "payments"
  | "messages"
  | "reviews"
  | "settings";

export interface AdminScreen {
  id: AdminScreenId;
  label: string;
  href: string;
  icon: Icon;
  built: boolean;
}

export const ADMIN_SCREENS: AdminScreen[] = [
  { id: "overview", label: "Overview", href: "/admin", icon: HouseIcon, built: true },
  { id: "orders", label: "Orders", href: "/admin/orders", icon: ClipboardTextIcon, built: false },
  { id: "calendar", label: "Calendar", href: "/admin/calendar", icon: CalendarBlankIcon, built: false },
  { id: "customers", label: "Customers", href: "/admin/customers", icon: UserIcon, built: false },
  { id: "services", label: "Services & Pricing", href: "/admin/services", icon: TagIcon, built: false },
  { id: "inventory", label: "Inventory", href: "/admin/inventory", icon: PackageIcon, built: false },
  { id: "payments", label: "Payments", href: "/admin/payments", icon: CreditCardIcon, built: false },
  { id: "messages", label: "Messages", href: "/admin/messages", icon: ChatCenteredTextIcon, built: false },
  { id: "reviews", label: "Reviews", href: "/admin/reviews", icon: StarIcon, built: false },
  { id: "settings", label: "Settings", href: "/admin/settings", icon: GearSixIcon, built: false },
];

/** A screen's route once it's built, or null while it's still coming. */
export function builtScreenHref(id: AdminScreenId): string | null {
  const screen = ADMIN_SCREENS.find((s) => s.id === id);
  return screen?.built ? screen.href : null;
}
