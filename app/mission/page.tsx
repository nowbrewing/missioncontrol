import MissionControl from "../../src/components/MissionControl";
import TopNav from "../../src/components/TopNav";

export default function MissionPage() {
  return (
    <>
      <TopNav />
      <main className="container containerMission">
        <h1 className="title">Mission control</h1>
        <p className="subtitle">
          Use Check In to turn your notes into prioritized tasks across your pillars.
        </p>
        <MissionControl />
      </main>
    </>
  );
}
