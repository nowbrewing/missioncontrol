import Reflection from "../../src/components/reflection/Reflection";
import TopNav from "../../src/components/TopNav";

export default function ReflectionPage() {
  return (
    <>
      <TopNav />
      <main className="container containerThinkpad">
        <h1 className="title">Reflection</h1>
        <p className="subtitle">
          A guided weekly review by pillar — look back at what you scheduled, completed, and
          missed in each area, then capture wins, misses, and focus for the week ahead.
        </p>
        <Reflection />
      </main>
    </>
  );
}
