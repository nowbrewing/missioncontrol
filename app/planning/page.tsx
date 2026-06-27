import { Suspense } from "react";
import PillarCalendar from "../../src/components/calendar/PillarCalendar";
import TopNav from "../../src/components/TopNav";

function PlanningFallback() {
  return <p className="sectionHint">Loading planning view…</p>;
}

export default function PlanningPage() {
  return (
    <>
      <TopNav />
      <main className="container containerCalendar">
        <header className="planningPageHeader">
          <h1 className="title planningPageTitle">Planning</h1>
          <p className="subtitle planningPageSubtitle">
            Schedule tasks by pillar, set milestones and habits, and keep weekly focus notes.
          </p>
        </header>
        <Suspense fallback={<PlanningFallback />}>
          <PillarCalendar />
        </Suspense>
      </main>
    </>
  );
}
