import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { EsqueciSenhaForm } from "@/components/auth/esqueci-senha-form";
import { getCurrentUser } from "@/lib/dal";

export const metadata: Metadata = { title: "Esqueci minha senha" };

export default async function EsqueciSenhaPage() {
  if (await getCurrentUser()) redirect("/painel");
  return (
    <AuthShell>
      <EsqueciSenhaForm />
    </AuthShell>
  );
}
