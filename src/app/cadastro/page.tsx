import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";
import { getCurrentUser } from "@/lib/dal";
import { googleConfigurado } from "@/lib/google";

export const metadata: Metadata = {
  title: "Criar conta",
};

export default async function CadastroPage() {
  if (await getCurrentUser()) redirect("/painel/lab");
  return (
    <AuthShell>
      <SignupForm googleAtivo={googleConfigurado()} />
    </AuthShell>
  );
}
