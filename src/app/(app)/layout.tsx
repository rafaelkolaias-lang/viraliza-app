import { AppFrame } from "@/components/app/app-frame";
import { ChatBoia } from "@/components/app/chat-boia";
import { requireUser } from "@/lib/dal";
import { tocarPresenca } from "@/lib/presenca";
import { getDividaCentavos, getNivelBadge, tocarAtividadeENivel } from "@/lib/niveis";
import { presoCentavos } from "@/lib/liberacao-creditos";
import { avisosAtivosPara } from "@/lib/notificacoes";
import { getStatusBonusIg } from "@/lib/bonus-instagram";
import { CREDITO_MENSAL_CENTAVOS, getCarteira, totalEntradas } from "@/lib/creditos";

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
  // Crédito NÃO nasce mais aqui. Abrir o painel não é pagar: todo crédito de
  // assinatura vem de um pagamento aprovado (cadastro do plano novo ou renovação
  // no webhook). Ver garantirCreditoMensal, removido em 06/ago/2026.
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
      {/* UMA boia no canto de baixo pros dois chats: o robô de ajuda (sempre) e
          a conversa com a equipe (só se o admin abriu). Eram dois botões
          empilhados até 12/08/2026 - o porquê da junção está no chat-boia.tsx.
          O crédito da assinatura vem daqui porque `lib/creditos` é server-only e
          a resposta pronta "assinatura x crédito" cita esse número. */}
      <ChatBoia creditoMensal={CREDITO_MENSAL_CENTAVOS} comEquipe={user.role !== "admin"} />
    </AppFrame>
  );
}
