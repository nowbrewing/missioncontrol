import SettingsSections from "../../src/components/settings/SettingsSections";
import TopNav from "../../src/components/TopNav";

type Props = {
  searchParams: Promise<{ onboarding?: string }>;
};

export default async function SettingsPage({ searchParams }: Props) {
  const params = await searchParams;
  const onboarding = params.onboarding === "1";

  return (
    <>
      <TopNav />
      <main className="container">
        <h1 className="title">{onboarding ? "Your pillars" : "Settings"}</h1>
        <p className="subtitle">
          {onboarding
            ? "What are the key areas of life you're focusing on right now? Add a brief description for each — you can change these anytime in Settings."
            : "Manage your pillars and browse your log history."}
        </p>
        <SettingsSections onboarding={onboarding} />
      </main>
    </>
  );
}
