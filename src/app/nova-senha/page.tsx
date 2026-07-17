import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { NovaSenhaForm } from "@/components/auth/nova-senha-form";

export const metadata: Metadata = { title: "Criar nova senha" };

export default async function NovaSenhaPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const sp = await searchParams;
  return (
    <AuthShell>
      <NovaSenhaForm token={sp.token ?? ""} />
    </AuthShell>
  );
}
