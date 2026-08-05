import { AppFrame } from "@/components/app/app-frame";
import { ChatWidget } from "@/components/app/chat-widget";
import { SuporteChat } from "@/components/app/suporte-chat";
import { requireUser } from "@/lib/dal";
import { tocarPresenca } from "@/lib/presenca";
import {
  JANELA_GARANTIA_DIAS,
  getDividaCentavos,
  getNivelBadge,
  tocarAtividadeENivel,
} from "@/lib/niveis";
import { presoCentavos } from "@/lib/liberacao-creditos";
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
  // ANTES da presença (que renova o vistoEm): marca o dia de atividade, aplica a
  // queda por inatividade 60d e recalcula o nível bronze/prata/ouro (1x/min).
  await tocarAtividadeENivel(user.id);
  await tocarPresenca(user.id); // marca presença (online/visto há X) - no máx 1x/min
  await garantirCreditoMensal(user.id); // libera o crédito mensal de brinde do assinante
  const [carteira, entradas, avisos, bonusIg, nivel, preso, divida] = await Promise.all([
    getCarteira(user.id),
    totalEntradas(user.id),
    avisosAtivosPara(user.id),
    getStatusBonusIg(user.id),
    getNivelBadge(user), // selo bronze/prata/ouro no menu lateral (null = admin/demo)
    presoCentavos(user.id), // crédito comprado em quarentena ("+X liberando")
    getDividaCentavos(user.id), // saldo devedor de reembolso (aviso vermelho)
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
      nivel={nivel}
      presoCentavos={preso}
      dividaCentavos={divida}
    >
      {children}
      {/* robô de ajuda: sempre disponível, é o botão de baixo no canto. A janela
          de garantia vem daqui porque `lib/niveis` é server-only e as respostas
          prontas do chat citam esse prazo */}
      <SuporteChat garantiaDias={JANELA_GARANTIA_DIAS} />
      {/* caixinha do chat com a equipe: só aparece se o admin abriu conversa.
          Quando aparece, fica LOGO ACIMA do robô (ver chat-widget.tsx). */}
      {user.role !== "admin" && <ChatWidget />}
    </AppFrame>
  );
}
