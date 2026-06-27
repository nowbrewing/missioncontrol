"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/mission", label: "Today" },
  { href: "/planning", label: "Planning" },
  { href: "/reflection", label: "Reflection" },
  { href: "/settings", label: "Settings" },
] as const;

export default function TopNavLinks() {
  const pathname = usePathname();

  return (
    <nav className="topbarNav">
      {NAV_ITEMS.map(({ href, label }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={active ? "topbarNavLink topbarNavLinkActive" : "topbarNavLink"}
            aria-current={active ? "page" : undefined}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
