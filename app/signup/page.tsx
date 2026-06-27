import { redirect } from "next/navigation";
import { Suspense } from "react";
import AuthForm from "../../src/components/AuthForm";
import AuthPageShell from "../../src/components/AuthPageShell";
import { getSessionUser } from "../../src/lib/auth";
import { userHasPillars } from "../../src/lib/pillars";

export default async function SignupPage() {
  const user = await getSessionUser();
  if (user) {
    if (!(await userHasPillars(user.id))) {
      redirect("/settings?onboarding=1");
    }
    redirect("/mission");
  }

  return (
    <AuthPageShell
      title="Create account"
      subtitle="Set up your account, then define the life areas you want to focus on."
      alternateAuth={{
        prompt: "Already have an account?",
        href: "/",
        label: "Sign in",
      }}
    >
      <Suspense>
        <AuthForm mode="signup" embedded />
      </Suspense>
    </AuthPageShell>
  );
}
