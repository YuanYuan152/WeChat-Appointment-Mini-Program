import { AuthForm } from "@/components/auth/auth-form";

export default function RegisterPage() {
  return (
    <section className="gradient-warm px-4 pb-16 pt-28 sm:px-6">
      <AuthForm type="register" />
    </section>
  );
}
