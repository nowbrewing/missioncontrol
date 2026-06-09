import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import AuthForm from "../../src/components/AuthForm";
import TopNav from "../../src/components/TopNav";
import { getSessionUser } from "../../src/lib/auth";

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect("/mission");

  return (
    <>
      <TopNav />
      <main className="container">
        <h1 className="title">Sign in</h1>
        <p className="subtitle">Welcome back to Mission Control.</p>
        <Suspense>
          <AuthForm mode="login" />
        </Suspense>
        <p style={{ marginTop: 16, fontSize: 14 }}>
          No account?{" "}
          <Link href="/signup" style={{ textDecoration: "underline" }}>
            Create one
          </Link>
        </p>
      </main>
    </>
  );
}
