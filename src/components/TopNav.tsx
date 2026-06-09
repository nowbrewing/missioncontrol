import Link from "next/link";
import { getSessionUser } from "../lib/auth";

export default async function TopNav() {
  const user = await getSessionUser();

  return (
    <header className="topbar">
      <div className="topbar-inner topbarRow">
        <Link className="topbar-home" href={user ? "/mission" : "/"}>
          Mission Control
        </Link>
        {user && (
          <nav className="topbarNav">
            <Link href="/mission">Mission</Link>
            <Link href="/scheduling">Scheduling</Link>
            <Link href="/pillars">Pillars</Link>
            <Link href="/daily">Daily</Link>
            <Link href="/tasks">Tasks</Link>
          </nav>
        )}
      </div>
    </header>
  );
}
