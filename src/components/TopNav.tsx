import Link from "next/link";
import { getSessionUser } from "../lib/auth";
import TopNavActions from "./TopNavActions";

export default async function TopNav() {
  const user = await getSessionUser();

  return (
    <header className="topbar">
      <div className="topbar-inner topbarRow">
        <Link className="topbar-home" href={user ? "/mission" : "/"}>
          Mission Control
        </Link>
        {user ? <TopNavActions /> : null}
      </div>
    </header>
  );
}
