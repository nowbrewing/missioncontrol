import SchedulingSetup from "../../src/components/SchedulingSetup";
import TopNav from "../../src/components/TopNav";

export default function SchedulingPage() {
  return (
    <>
      <TopNav />
      <main className="container">
        <h1 className="title">Scheduling</h1>
        <p className="subtitle">
          Set up habits and routines that reset every Monday. Track progress on the
          Checklist tab in Mission Control.
        </p>
        <SchedulingSetup />
      </main>
    </>
  );
}
