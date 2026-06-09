import DailyLogForm from "../../src/components/DailyLogForm";
import TopNav from "../../src/components/TopNav";

export default function DailyPage() {
  return (
    <>
      <TopNav />
      <main className="container">
        <h1 className="title">Daily log</h1>
        <p className="subtitle">
          Review everything you&apos;ve logged for a day — each submission is timestamped.
          Add more notes anytime.
        </p>
        <DailyLogForm />
      </main>
    </>
  );
}
