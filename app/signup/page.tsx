import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import AuthForm from "../../src/components/AuthForm";
import TopNav from "../../src/components/TopNav";
import { getSessionUser } from "../../src/lib/auth";
import { userHasPillars } from "../../src/lib/pillars";
import { getTursoClient } from "../../src/lib/turso";

export default async function SignupPage() {
  const user = await getSessionUser();
  if (user) {
    const turso = getTursoClient();
    if (turso && !(await userHasPillars(turso, user.id))) {
      redirect("/pillars?onboarding=1");
    }
    redirect("/mission");
  }

  return (
    <>
      <TopNav />
      <main className="container">
        <h1 className="title">Create account</h1>
        <p className="subtitle">
          Create your account, then define the life areas you want to focus on.
        </p>
        <Suspense>
          <AuthForm mode="signup" />
        </Suspense>
        <p style={{ marginTop: 16, fontSize: 14 }}>
          Already have an account?{" "}
          <Link href="/login" style={{ textDecoration: "underline" }}>
            Sign in
          </Link>
        </p>
      </main>
    </>
  );
}
