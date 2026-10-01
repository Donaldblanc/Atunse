import { ArrowRightIcon } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

export function CardLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link className="ov-card-link" href={href}>
      {children} <ArrowRightIcon size={16} weight="bold" aria-hidden="true" />
    </Link>
  );
}
