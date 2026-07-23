import { Suspense } from "react";
import Reflection from "../../src/components/reflection/Reflection";
import TopNav from "../../src/components/TopNav";

function JournalFallback() {
  return <p className="sectionHint">Loading journal…</p>;
}

export default function ReflectionPage() {
  return (
    <>
      <TopNav />
      <main className="container containerThinkpad">
        <h1 className="title">Journal</h1>
        <p className="subtitle">
          Weekly review across life — or open a pillar to load its context notes, milestones,
          and recent activity.
        </p>
        <Suspense fallback={<JournalFallback />}>
          <Reflection />
        </Suspense>
      </main>
    </>
  );
}
