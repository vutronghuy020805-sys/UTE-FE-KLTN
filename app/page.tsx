export const dynamic = 'force-dynamic';

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function RootPage() {
  const session = await getServerSession(authOptions);

  if (!session) redirect("/login");

  const role = session.user.system_role;
  if (role === "ADMIN")    redirect("/admin/dashboard");
  if (role === "DEAN")     redirect("/dean/dashboard");
  if (role === "STUDENT")  redirect("/student/status");
  if (role === "LECTURER") redirect("/supervisor/students");

  redirect("/login");
}
