import { AppFrame } from "@/components/app/app-frame";
import { ChatWidget } from "@/components/app/chat-widget";
import { requireUser } from "@/lib/dal";
import { tocarPresenca } from "@/lib/presenca";
import { avisosAtivosPara } from "@/lib/notificacoes";
import { getStatusBonusIg } from "@/lib/bonus-instagram";
import {
  garantirCreditoMensal,
  getCarteira,
  totalEntradas,
} from "@/lib/creditos";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser(); // redireciona pro /login se não estiver logado
  await tocarPresenca(user.id); // marca presença (online/visto há X) - no máx 1x/min
  await garantirCreditoMensal(user.id); // libera o crédito mensal de brinde do assinante
  const [carteira, entradas, avisos, bonusIg] = await Promise.all([
    getCarteira(user.id),
    totalEntradas(user.id),
    avisosAtivosPara(user.id),
    getStatusBonusIg(user.id),
  ]);
  // % do crédito que ainda não foi gasto (saldo / total que entrou).
  // base = max(entradas, saldo) pra nunca mostrar 0% tendo saldo (ex.: saldo
  // ajustado direto no banco, sem transação de entrada).
  const base = Math.max(entradas, carteira.saldoCentavos);
  const pctNaoGasto = base > 0 ? Math.round((carteira.saldoCentavos / base) * 100) : 0;

  return (
    <AppFrame
      user={{
        nome: user.nome,
        email: user.email,
        role: user.role as "admin" | "user",
      }}
      saldoCentavos={carteira.saldoCentavos}
      assinante={carteira.assinante}
      pctNaoGasto={pctNaoGasto}
      avisos={avisos}
      bonusIgStatus={bonusIg.status}
    >
      {children}
      {/* caixinha do chat: só aparece se o admin abriu conversa com a pessoa */}
      {user.role !== "admin" && <ChatWidget />}
    </AppFrame>
  );
}
