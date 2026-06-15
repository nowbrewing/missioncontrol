import Correction from "../../src/components/correction/Correction";
import TopNav from "../../src/components/TopNav";

export default function CorrectionPage() {
  return (
    <>
      <TopNav />
      <main className="container containerThinkpad">
        <h1 className="title">Correction</h1>
        <p className="subtitle">
          Fix what was recorded wrong or left ambiguous this week — clarify entries in your logs,
          pillar context, and notes so the agent doesn&apos;t keep assuming the wrong thing.
        </p>
        <Correction />
      </main>
    </>
  );
}
