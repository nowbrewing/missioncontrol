"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

type NavPillar = {
  id: number;
  name: string;
};

type PillarMenuKind = "plan" | "journal";

const NAV_ITEMS: Array<
  | { href: string; label: string }
  | { href: string; label: string; pillarMenu: PillarMenuKind }
> = [
  { href: "/mission", label: "Today" },
  { href: "/planning", label: "Plan", pillarMenu: "plan" },
  { href: "/reflection", label: "Journal", pillarMenu: "journal" },
];

function GearIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.2.6.7 1 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </svg>
  );
}

export default function TopNavActions({ pillars }: { pillars: NavPillar[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [openPillarMenu, setOpenPillarMenu] = useState<PillarMenuKind | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const menuId = useId();
  const planMenuId = useId();
  const journalMenuId = useId();
  const settingsMenuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  const planActive = pathname === "/planning" || pathname.startsWith("/planning/");
  const journalActive = pathname === "/reflection" || pathname.startsWith("/reflection/");
  const settingsActive = pathname === "/settings" || pathname.startsWith("/settings/");
  const urlPillarId = Number(searchParams.get("pillar"));
  const activePlanPillarId =
    planActive && Number.isFinite(urlPillarId) ? urlPillarId : null;
  const activeJournalPillarId =
    journalActive && Number.isFinite(urlPillarId) ? urlPillarId : null;
  const journalGeneralActive = journalActive && !Number.isFinite(urlPillarId);

  useEffect(() => {
    setMenuOpen(false);
    setOpenPillarMenu(null);
    setSettingsOpen(false);
  }, [pathname, searchParams]);

  useEffect(() => {
    if (!menuOpen && !openPillarMenu && !settingsOpen) return;

    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setMenuOpen(false);
        setOpenPillarMenu(null);
        setSettingsOpen(false);
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setOpenPillarMenu(null);
        setSettingsOpen(false);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen, openPillarMenu, settingsOpen]);

  async function logout() {
    setMenuOpen(false);
    setOpenPillarMenu(null);
    setSettingsOpen(false);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  function togglePillarMenu(kind: PillarMenuKind) {
    setSettingsOpen(false);
    setOpenPillarMenu((current) => (current === kind ? null : kind));
  }

  function renderPillarDesktop(kind: PillarMenuKind) {
    const label = kind === "plan" ? "Plan" : "Journal";
    const baseHref = kind === "plan" ? "/planning" : "/reflection";
    const active = kind === "plan" ? planActive : journalActive;
    const menuDomId = kind === "plan" ? planMenuId : journalMenuId;
    const isOpen = openPillarMenu === kind;
    const activePillarId = kind === "plan" ? activePlanPillarId : activeJournalPillarId;

    if (pillars.length === 0) {
      return (
        <Link
          href={baseHref}
          className={active ? "topbarNavLink topbarNavLinkActive" : "topbarNavLink"}
          aria-current={active ? "page" : undefined}
        >
          {label}
        </Link>
      );
    }

    return (
      <div className="topbarPlanning">
        <button
          type="button"
          className={
            active
              ? "topbarNavLink topbarNavLinkActive topbarPlanningTrigger"
              : "topbarNavLink topbarPlanningTrigger"
          }
          aria-expanded={isOpen}
          aria-controls={menuDomId}
          aria-haspopup="menu"
          onClick={() => togglePillarMenu(kind)}
        >
          {label}
          <span
            className={`topbarPlanningChevron ${isOpen ? "topbarPlanningChevronOpen" : ""}`}
            aria-hidden="true"
          >
            ▾
          </span>
        </button>
        {isOpen ? (
          <ul className="topbarPlanningMenu" id={menuDomId} role="menu" aria-label={`${label} options`}>
            {kind === "journal" ? (
              <li role="none">
                <Link
                  href="/reflection"
                  role="menuitem"
                  className={
                    journalGeneralActive
                      ? "topbarPlanningOption topbarPlanningOptionActive"
                      : "topbarPlanningOption"
                  }
                  aria-current={journalGeneralActive ? "page" : undefined}
                  onClick={() => setOpenPillarMenu(null)}
                >
                  General
                </Link>
              </li>
            ) : null}
            {pillars.map((pillar) => {
              const href =
                kind === "plan"
                  ? `/planning?pillar=${pillar.id}`
                  : `/reflection?pillar=${pillar.id}`;
              const optionActive = activePillarId === pillar.id;
              return (
                <li key={pillar.id} role="none">
                  <Link
                    href={href}
                    role="menuitem"
                    className={
                      optionActive
                        ? "topbarPlanningOption topbarPlanningOptionActive"
                        : "topbarPlanningOption"
                    }
                    aria-current={optionActive ? "page" : undefined}
                    onClick={() => setOpenPillarMenu(null)}
                  >
                    {pillar.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    );
  }

  function renderPillarMobile(kind: PillarMenuKind) {
    const label = kind === "plan" ? "Plan" : "Journal";
    const baseHref = kind === "plan" ? "/planning" : "/reflection";
    const active = kind === "plan" ? planActive : journalActive;
    const activePillarId = kind === "plan" ? activePlanPillarId : activeJournalPillarId;

    if (pillars.length === 0) {
      return (
        <Link
          href={baseHref}
          role="menuitem"
          className={active ? "topbarMenuLink topbarMenuLinkActive" : "topbarMenuLink"}
          aria-current={active ? "page" : undefined}
          onClick={() => setMenuOpen(false)}
        >
          {label}
        </Link>
      );
    }

    return (
      <div className="topbarMenuPlanning">
        <p className="topbarMenuPlanningLabel">{label}</p>
        {kind === "journal" ? (
          <Link
            href="/reflection"
            role="menuitem"
            className={
              journalGeneralActive
                ? "topbarMenuLink topbarMenuLinkActive topbarMenuPlanningLink"
                : "topbarMenuLink topbarMenuPlanningLink"
            }
            aria-current={journalGeneralActive ? "page" : undefined}
            onClick={() => setMenuOpen(false)}
          >
            General
          </Link>
        ) : null}
        {pillars.map((pillar) => {
          const href =
            kind === "plan"
              ? `/planning?pillar=${pillar.id}`
              : `/reflection?pillar=${pillar.id}`;
          const optionActive = activePillarId === pillar.id;
          return (
            <Link
              key={pillar.id}
              href={href}
              role="menuitem"
              className={
                optionActive
                  ? "topbarMenuLink topbarMenuLinkActive topbarMenuPlanningLink"
                  : "topbarMenuLink topbarMenuPlanningLink"
              }
              aria-current={optionActive ? "page" : undefined}
              onClick={() => setMenuOpen(false)}
            >
              {pillar.name}
            </Link>
          );
        })}
      </div>
    );
  }

  const settingsMenu = settingsOpen ? (
    <div className="topbarSettingsMenu" id={settingsMenuId} role="menu" aria-label="Account">
      <Link
        href="/settings"
        role="menuitem"
        className={
          settingsActive
            ? "topbarSettingsOption topbarSettingsOptionActive"
            : "topbarSettingsOption"
        }
        aria-current={settingsActive ? "page" : undefined}
        onClick={() => setSettingsOpen(false)}
      >
        Settings
      </Link>
      <button
        type="button"
        role="menuitem"
        className="topbarSettingsOption topbarSettingsSignOut"
        onClick={() => void logout()}
      >
        Sign out
      </button>
    </div>
  ) : null;

  return (
    <div className="topbarActions" ref={rootRef}>
      <nav className="topbarNav topbarNavDesktop" aria-label="Primary">
        {NAV_ITEMS.map((item) => {
          if ("pillarMenu" in item) {
            return <div key={item.href}>{renderPillarDesktop(item.pillarMenu)}</div>;
          }
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={active ? "topbarNavLink topbarNavLinkActive" : "topbarNavLink"}
              aria-current={active ? "page" : undefined}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <button
        type="button"
        className="topbarMenuBtn"
        aria-expanded={menuOpen}
        aria-controls={menuId}
        aria-label={menuOpen ? "Close menu" : "Open menu"}
        onClick={() => {
          setOpenPillarMenu(null);
          setSettingsOpen(false);
          setMenuOpen((v) => !v);
        }}
      >
        <span className="topbarMenuIcon" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </button>

      {menuOpen ? (
        <div className="topbarMenuPanel" id={menuId} role="menu">
          <nav className="topbarMenuNav" aria-label="Primary">
            {NAV_ITEMS.map((item) => {
              if ("pillarMenu" in item) {
                return <div key={item.href}>{renderPillarMobile(item.pillarMenu)}</div>;
              }
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  role="menuitem"
                  className={active ? "topbarMenuLink topbarMenuLinkActive" : "topbarMenuLink"}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setMenuOpen(false)}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      ) : null}

      <div className="topbarSettings">
        <button
          type="button"
          className={
            settingsActive || settingsOpen
              ? "topbarSettingsBtn topbarSettingsBtnActive"
              : "topbarSettingsBtn"
          }
          aria-expanded={settingsOpen}
          aria-controls={settingsMenuId}
          aria-haspopup="menu"
          aria-label="Settings menu"
          onClick={() => {
            setMenuOpen(false);
            setOpenPillarMenu(null);
            setSettingsOpen((v) => !v);
          }}
        >
          <GearIcon />
        </button>
        {settingsMenu}
      </div>
    </div>
  );
}
