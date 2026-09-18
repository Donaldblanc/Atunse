"use client";

import { useRouter } from "next/navigation";
import { SignOutIcon } from "@phosphor-icons/react/dist/ssr";

export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    await fetch("/api/v1/auth/sign-out", { method: "POST" });
    router.push("/sign-in");
    router.refresh();
  }

  return (
    <button type="button" onClick={handleSignOut} className="admin-nav-item" data-active="false">
      <span className="admin-nav-icon" aria-hidden="true">
        <SignOutIcon size={18} weight="regular" />
      </span>
      Sign out
    </button>
  );
}
