import Link from "next/link";
import { Suspense } from "react";
import { getSessionUser } from "../lib/auth";
import { listPillars } from "../lib/mongodb/store";
import TopNavActions from "./TopNavActions";

export default async function TopNav() {
  const user = await getSessionUser();
  const pillars = user
    ? (await listPillars(user.id)).map((p) => ({ id: p.id as number, name: p.name as string }))
    : [];

  return (
    <header className="topbar">
      <div className="topbar-inner topbarRow">
        <Link className="topbar-home" href={user ? "/mission" : "/"}>
          Mission Control
        </Link>
        {user ? (
          <Suspense fallback={<div className="topbarActions" aria-hidden="true" />}>
            <TopNavActions pillars={pillars} />
          </Suspense>
        ) : null}
      </div>
    </header>
  );
}
