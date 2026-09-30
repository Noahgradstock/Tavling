import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Person } from "@/trust-engine";
import { activeSession, SESSION_COOKIE } from "@/lib/auth";
import { kb } from "@/lib/trust-server";

// For server components: the signed-in user, or a redirect to the login page.
// The proxy already checks this; pages that read data check again, close to the data.
export async function requireUser(): Promise<Person> {
  const session = await activeSession((await cookies()).get(SESSION_COOKIE)?.value);
  const user = session ? kb.people.find((p) => p.id === session.sub && !p.left) : undefined;
  if (!user) redirect("/login");
  return user;
}
