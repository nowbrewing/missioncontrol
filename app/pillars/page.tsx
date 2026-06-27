import { redirect } from "next/navigation";

type Props = {
  searchParams: Promise<{ onboarding?: string }>;
};

export default async function PillarsRedirect({ searchParams }: Props) {
  const params = await searchParams;
  if (params.onboarding === "1") redirect("/settings?onboarding=1");
  redirect("/settings");
}
