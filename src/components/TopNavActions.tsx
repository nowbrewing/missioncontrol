"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

const NAV_ITEMS = [
  { href: "/mission", label: "Today" },
  { href: "/planning", label: "Planning" },
  { href: "/reflection", label: "Reflection" },
  { href: "/settings", label: "Settings" },
] as const;

export default function TopNavActions() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function logout() {
    setOpen(false);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <div className="topbarActions" ref={rootRef}>
      <nav className="topbarNav topbarNavDesktop" aria-label="Primary">
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
      <button type="button" className="outlineButton topbarLogout topbarLogoutDesktop" onClick={() => void logout()}>
        Sign out
      </button>

      <button
        type="button"
        className="topbarMenuBtn"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="topbarMenuIcon" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </button>

      {open ? (
        <div className="topbarMenuPanel" id={menuId} role="menu">
          <nav className="topbarMenuNav" aria-label="Primary">
            {NAV_ITEMS.map(({ href, label }) => {
              const active = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
                  role="menuitem"
                  className={
                    active ? "topbarMenuLink topbarMenuLinkActive" : "topbarMenuLink"
                  }
                  aria-current={active ? "page" : undefined}
                  onClick={() => setOpen(false)}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
          <button type="button" className="topbarMenuSignOut" role="menuitem" onClick={() => void logout()}>
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
