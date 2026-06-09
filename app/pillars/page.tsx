import PillarsSetup from "../../src/components/PillarsSetup";
import TopNav from "../../src/components/TopNav";

type Props = {
  searchParams: Promise<{ onboarding?: string }>;
};

export default async function PillarsPage({ searchParams }: Props) {
  const params = await searchParams;
  const onboarding = params.onboarding === "1";

  return (
    <>
      <TopNav />
      <main className="container">
        <h1 className="title">{onboarding ? "Your pillars" : "Pillars"}</h1>
        <p className="subtitle">
          {onboarding
            ? "What are the key areas of life you're focusing on right now? Add a brief description for each — you can change these anytime."
            : "Define your life focus areas and attach milestones with optional deadlines."}
        </p>
        <PillarsSetup onboarding={onboarding} />
      </main>
    </>
  );
}
