import { AuthPageShell } from "@/components/auth/auth-page-shell";

interface LoginPageProps {
  searchParams: Promise<{ redirect?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { redirect } = await searchParams;
  return (
    <section className="gradient-warm px-4 pb-16 pt-28 sm:px-6">
      <AuthPageShell redirectTo={redirect} type="login" />
    </section>
  );
}
