import { redirect } from "next/navigation";
import { Suspense } from "react";
import AuthForm from "../src/components/AuthForm";
import LandingPageShell from "../src/components/LandingPageShell";
import { getSessionUser } from "../src/lib/auth";
import { userHasPillars } from "../src/lib/pillars";

export default async function HomePage() {
  const user = await getSessionUser();

  if (user) {
    if (!(await userHasPillars(user.id))) {
      redirect("/settings?onboarding=1");
    }
    redirect("/mission");
  }

  return (
    <LandingPageShell
      title="Sign in"
      subtitle="Welcome back — pick up where you left off."
      alternateAuth={{
        prompt: "New to Mission Control?",
        href: "/signup",
        label: "Create an account",
        primary: true,
      }}
    >
      <Suspense>
        <AuthForm mode="login" embedded />
      </Suspense>
    </LandingPageShell>
  );
}
