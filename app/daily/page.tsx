import DailyLogForm from "../../src/components/DailyLogForm";
import TopNav from "../../src/components/TopNav";

export default function DailyPage() {
  return (
    <>
      <TopNav />
      <main className="container">
        <h1 className="title">Daily logs</h1>
        <p className="subtitle">
          Each check-in saves two entries: looking back (wins) and looking ahead (brain
          dump). Both appear on the plan date.
        </p>
        <DailyLogForm />
      </main>
    </>
  );
}
