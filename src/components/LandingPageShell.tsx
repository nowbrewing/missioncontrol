import Link from "next/link";
import type { ReactNode } from "react";

const MISSION_CONTROL_ABOUT = {
  title: "This is Mission Control.",
  tagline: "Welcome to the flight deck, Pilot.",
  lead: "Your life goals aren't meant to sit in a stagnant notebook—they are a trajectory. This is your daily launchpad to clear the noise, map the stars, and execute with precision.",
  points: [
    {
      label: "Pre-Flight Check-In",
      text: "Dump your brain, and let the system prioritize your absolute essentials for the day.",
    },
    {
      label: "Co-Pilot Accountability",
      text: "Get real-time coaching and strategic pushback when you're overloading your schedule.",
    },
    {
      label: "The Orbital View",
      text: "Track your long-term pillars, active milestones, and the week ahead from a single, unified dashboard.",
    },
  ],
};

type LandingPageShellProps = {
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

export default function LandingPageShell({
  title,
  subtitle,
  children,
  alternateAuth,
}: LandingPageShellProps) {
  return (
    <div className="landingPage">
      <video
        className="landingVideo"
        autoPlay
        muted
        loop
        playsInline
        aria-hidden
      >
        <source src="/landingcover.mp4" type="video/mp4" />
      </video>
      <div className="landingScrim" aria-hidden />

      <div className="landingLayout">
        <div className="landingFrame">
          <div className="landingCopy" aria-label="About Mission Control">
            <h1 className="landingCopyTitle">{MISSION_CONTROL_ABOUT.title}</h1>
            <p className="landingCopyTagline">{MISSION_CONTROL_ABOUT.tagline}</p>
            <p className="landingCopyLead">{MISSION_CONTROL_ABOUT.lead}</p>
            <ul className="landingCopyList">
              {MISSION_CONTROL_ABOUT.points.map((point) => (
                <li key={point.label}>
                  <strong className="landingCopyLabel">{point.label}</strong>
                  <span aria-hidden="true"> → </span>
                  {point.text}
                </li>
              ))}
            </ul>
          </div>

          <aside className="landingPanel">
            <h2 className="landingPanelTitle">{title}</h2>
            {subtitle ? <p className="landingPanelSubtitle">{subtitle}</p> : null}
            {children}
            {alternateAuth ? (
              <div className="landingPanelFooter">
                <p className="landingPanelFooterPrompt">{alternateAuth.prompt}</p>
                <Link
                  className={
                    alternateAuth.primary
                      ? "chatSendBtn landingPanelFooterBtn"
                      : "outlineButton landingPanelFooterBtn"
                  }
                  href={alternateAuth.href}
                >
                  {alternateAuth.label}
                </Link>
              </div>
            ) : null}
          </aside>
        </div>
      </div>
    </div>
  );
}
