import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";

// Landing route: send drivers to the mobile view, staff to the dashboard.
export default async function Home() {
  const profile = await getProfile();
  if (profile.role === "driver") redirect("/driver");
  redirect("/dashboard");
}
