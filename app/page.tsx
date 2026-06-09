import Link from "next/link";
import { redirect } from "next/navigation";
import TopNav from "../src/components/TopNav";
import { getSessionUser } from "../src/lib/auth";
import { userHasPillars } from "../src/lib/pillars";
import { getTursoClient } from "../src/lib/turso";

export default async function HomePage() {
  const user = await getSessionUser();

  if (user) {
    const turso = getTursoClient();
    if (turso && !(await userHasPillars(turso, user.id))) {
      redirect("/pillars?onboarding=1");
    }
    redirect("/mission");
  }

  return (
    <>
      <TopNav />
      <main className="container">
        <h1 className="title">Mission Control</h1>
        <p className="subtitle">Life planning and daily mission control.</p>

        <div className="inlineForm" style={{ marginBottom: 24 }}>
          <Link className="chatSendBtn" href="/signup" style={{ display: "inline-block", textAlign: "center" }}>
            Get started
          </Link>
          <Link className="outlineButton" href="/login">
            Sign in
          </Link>
        </div>

        <Link className="cardLink" href="/mission">
          <div className="card cardClickable">
            <strong>Mission control</strong>
            <div style={{ opacity: 0.8, marginTop: 4 }}>
              Today&apos;s command center — AI prioritization, tasks, and focus.
            </div>
          </div>
        </Link>

        <div style={{ height: 12 }} />

        <Link className="cardLink" href="/pillars">
          <div className="card cardClickable">
            <strong>Pillars</strong>
            <div style={{ opacity: 0.8, marginTop: 4 }}>
              Life focus areas with milestones and optional deadlines.
            </div>
          </div>
        </Link>

        <div style={{ height: 12 }} />

        <Link className="cardLink" href="/daily">
          <div className="card cardClickable">
            <strong>Daily log</strong>
            <div style={{ opacity: 0.8, marginTop: 4 }}>
              What went well, what didn&apos;t, and your key focus for the day.
            </div>
          </div>
        </Link>

        <div style={{ height: 12 }} />

        <Link className="cardLink" href="/tasks">
          <div className="card cardClickable">
            <strong>Tasks & chores</strong>
            <div style={{ opacity: 0.8, marginTop: 4 }}>
              Things to get done — some with deadlines, some without.
            </div>
          </div>
        </Link>

      </main>
    </>
  );
}
