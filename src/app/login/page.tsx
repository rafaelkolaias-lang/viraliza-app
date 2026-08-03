import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { getCurrentUser } from "@/lib/dal";
import { googleConfigurado } from "@/lib/google";
import { emailConfigurado } from "@/lib/email";

export const metadata: Metadata = {
  title: "Entrar",
};

// mensagens dos redirecionamentos (ex.: erros do login com Google)
const AVISOS_ERRO: Record<string, string> = {
  google_off: "Login com Google indisponível no momento.",
  google_cancelado: "Login com Google cancelado.",
  google_estado: "A sessão do login com Google expirou. Tente de novo.",
  google_falha: "Não consegui entrar com o Google. Tente de novo.",
  sem_compra:
    "Não achamos uma compra com esse e-mail do Google. Compre com ele e tente de novo.",
  suspenso: "Acesso suspenso. Fale com o suporte.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; reset?: string }>;
}) {
  if (await getCurrentUser()) redirect("/painel/lab");
  const sp = await searchParams;
  const avisoErro = sp.erro ? AVISOS_ERRO[sp.erro] : undefined;
  const avisoOk =
    sp.reset === "ok" ? "Senha redefinida! Agora é só entrar com a nova senha." : undefined;

  return (
    <AuthShell>
      <LoginForm
        googleAtivo={googleConfigurado()}
        resetAtivo={emailConfigurado()}
        avisoErro={avisoErro}
        avisoOk={avisoOk}
      />
    </AuthShell>
  );
}
