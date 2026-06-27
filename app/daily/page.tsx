import { redirect } from "next/navigation";

export default function DailyRedirect() {
  redirect("/settings#history");
}
