import Thinkpad from "../../src/components/thinkpad/Thinkpad";
import TopNav from "../../src/components/TopNav";

export default function ThinkpadPage() {
  return (
    <>
      <TopNav />
      <main className="container containerThinkpad">
        <h1 className="title">Thinkpad</h1>
        <p className="subtitle">
          A dedicated space for longer brainstorming and planning — general AI with your life
          context, then save notes where they belong.
        </p>
        <Thinkpad />
      </main>
    </>
  );
}
