import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { getCurrentUser } from "@/lib/dal";

export const metadata: Metadata = {
  title: "Entrar",
};

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/painel");
  return (
    <AuthShell>
      <LoginForm />
    </AuthShell>
  );
}
