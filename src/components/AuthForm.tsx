"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

type Mode = "login" | "signup";

export default function AuthForm({
  mode,
  embedded = false,
}: {
  mode: Mode;
  embedded?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next =
    searchParams.get("next") ||
    (mode === "signup" ? "/pillars?onboarding=1" : "/mission");

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/signup";
      const body =
        mode === "login"
          ? { email, password }
          : { email, name, password };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Something went wrong");
        return;
      }
      router.push(next);
      router.refresh();
    } catch {
      setError("Network error — try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      className={embedded ? "authForm" : "authForm card"}
      onSubmit={onSubmit}
    >
      {mode === "signup" && (
        <div className="modalField">
          <label className="modalLabel" htmlFor="name">
            Name
          </label>
          <input
            id="name"
            className="invInput"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
          />
        </div>
      )}

      <div className="modalField">
        <label className="modalLabel" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          className="invInput"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
      </div>

      <div className="modalField">
        <label className="modalLabel" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          className="invInput"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
        />
      </div>

      {error && <p className="modalError">{error}</p>}

      <button
        className="chatSendBtn authFormSubmit"
        type="submit"
        disabled={loading}
      >
        {loading ? "..." : mode === "login" ? "Sign in" : "Create account"}
      </button>
    </form>
  );
}
