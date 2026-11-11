import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { safeRedirectPath } from "@/lib/auth/redirect";

interface LoginPageProps {
  searchParams: Promise<{ redirect?: string | string[] }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { redirect } = await searchParams;
  return (
    <section className="gradient-warm px-4 pb-16 pt-28 sm:px-6">
      <AuthPageShell redirectTo={safeRedirectPath(redirect)} type="login" />
    </section>
  );
}
