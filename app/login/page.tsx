import { redirect } from "next/navigation";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = params.next;
  const query =
    typeof next === "string" && next
      ? `?next=${encodeURIComponent(next)}`
      : "";
  redirect(`/${query}`);
}
