import Link from "next/link";
import type { ReactNode } from "react";
import TopNav from "./TopNav";

const MISSION_CONTROL_ABOUT = {
  lead: "Your daily command center for life planning.",
  points: [
    "Check-in and AI-prioritized tasks for today",
    "This week board, pillars, and milestones",
    "Daily logs, routines, and pillars in one place",
  ],
};

type AuthPageShellProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  alternateAuth?: {
    prompt: string;
    href: string;
    label: string;
    primary?: boolean;
  };
};

export default function AuthPageShell({
  title,
  subtitle,
  children,
  alternateAuth,
}: AuthPageShellProps) {
  return (
    <>
      <TopNav />
      <main className="authPage">
        <div className="authPageStack">
          <section className="authPageFormCard">
            <h1 className="authPageTitle">{title}</h1>
            {subtitle ? <p className="authPageSubtitle">{subtitle}</p> : null}
            {children}
          </section>

          <section className="authPageAbout" aria-label="About Mission Control">
            <p className="authPageAboutTitle">Mission Control</p>
            <p className="authPageAboutLead">{MISSION_CONTROL_ABOUT.lead}</p>
            <ul className="authPageAboutList">
              {MISSION_CONTROL_ABOUT.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </section>

          {alternateAuth ? (
            <section className="authPageSignup">
              <p className="authPageSignupPrompt">{alternateAuth.prompt}</p>
              <Link
                className={
                  alternateAuth.primary
                    ? "chatSendBtn authPageSignupBtn"
                    : "outlineButton authPageSignupBtn"
                }
                href={alternateAuth.href}
              >
                {alternateAuth.label}
              </Link>
            </section>
          ) : null}
        </div>
      </main>
    </>
  );
}
