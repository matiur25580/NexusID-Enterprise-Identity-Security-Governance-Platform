import { auth } from "@/auth";
import { redirect } from "next/navigation";
import SignInPanel from "@/components/sign-in-panel";

export default async function SignInPage() {
  const session = await auth();
  if (session?.user) redirect("/");

  const providers = {
    google: Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET),
    github: Boolean(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET),
  };

  return <SignInPanel providers={providers} />;
}
