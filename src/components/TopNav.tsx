import Link from "next/link";
import { getSessionUser } from "../lib/auth";
import LogoutButton from "./LogoutButton";

export default async function TopNav() {
  const user = await getSessionUser();

  return (
    <header className="topbar">
      <div className="topbar-inner topbarRow">
        <Link className="topbar-home" href={user ? "/mission" : "/"}>
          Mission Control
        </Link>
        {user && (
          <div className="topbarActions">
            <nav className="topbarNav">
              <Link href="/pillars">Pillars</Link>
              <Link href="/scheduling">Routines</Link>
              <Link href="/daily">Daily logs</Link>
            </nav>
            <LogoutButton />
          </div>
        )}
      </div>
    </header>
  );
}
