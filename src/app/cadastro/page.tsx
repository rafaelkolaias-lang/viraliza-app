import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";
import { getCurrentUser } from "@/lib/dal";

export const metadata: Metadata = {
  title: "Criar conta",
};

export default async function CadastroPage() {
  if (await getCurrentUser()) redirect("/painel");
  return (
    <AuthShell>
      <SignupForm />
    </AuthShell>
  );
}
