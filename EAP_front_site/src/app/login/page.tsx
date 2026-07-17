import { AuthForm } from "@/components/auth/auth-form";

interface LoginPageProps {
  searchParams: Promise<{ redirect?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { redirect } = await searchParams;
  return (
    <section className="gradient-warm px-4 pb-16 pt-28 sm:px-6">
      <AuthForm type="login" redirectTo={redirect} />
    </section>
  );
}
