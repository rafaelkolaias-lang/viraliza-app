/**
 * Relógio da aplicação: roda UMA vez quando o servidor Next sobe (next start) e
 * agenda a varredura de manutenção. Primeira passada 1 min depois do boot (deixa
 * o app estabilizar), depois de 10 em 10 min.
 *
 * Não existe cron nem agendador externo: é daqui que sai TUDO que acontece
 * sozinho na plataforma. Rotina nova entra na lista ROTINAS abaixo, e é só isso
 * (antes cada uma repetia o próprio par "chama + catch", e como os dois lados do
 * time acrescentam rotina aqui, o arquivo era conflito garantido em toda junção).
 *
 * Cada rotina tem o catch dela de propósito: uma falhar não pode impedir as
 * outras de rodar na mesma batida.
 */
export async function register() {
  // só no servidor Node (não roda no edge nem no build do cliente)
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // nome antigo de propósito: renomear faria o hot-reload do dev não enxergar o
  // timer que já está de pé e ligar um segundo por cima
  const g = globalThis as { __varreduraReembolsos?: ReturnType<typeof setInterval> };
  if (g.__varreduraReembolsos) return;

  const { verificarReembolsos, verificarReembolsosCakto } = await import("@/lib/reembolsos");
  const { aplicarLiberacoesVencidas } = await import("@/lib/liberacao-creditos");
  const { avisarAssinaturasVencendo } = await import("@/lib/avisos-assinatura");
  const { limparEntradasVencidas, encerrarPreparandoPresos } = await import("@/lib/jobs");

  const ROTINAS: { nome: string; fn: () => Promise<unknown> }[] = [
    // nem a Cakto nem a Kiwify mandam webhook de "reembolso solicitado": a gente
    // confere as vendas recentes e suspende/restaura os créditos pelo status
    { nome: "reembolsos/cakto", fn: verificarReembolsosCakto },
    { nome: "reembolsos/kiwify", fn: verificarReembolsos },
    // crédito comprado em quarentena cujo 8º dia chegou: cai no saldo
    { nome: "liberacao", fn: aplicarLiberacoesVencidas },
    // assinatura vencendo em 3 dias: manda o e-mail de aviso (1 por ciclo)
    { nome: "assinatura/vencimento", fn: avisarAssinaturasVencendo },
    // Editor: rascunho largado na etapa das mídias (12h) e mídia de entrada
    // guardada pro "Tentar Novamente" e o "Editar novamente" (24h)
    { nome: "uploads", fn: limparEntradasVencidas },
    // Editor: vídeo esperando um navegador que não voltou. Passou de 30 min,
    // vira erro, senão o card gira pra sempre e ocupa vaga de produção
    { nome: "jobs/preparando", fn: encerrarPreparandoPresos },
  ];

  const rodar = () => {
    for (const r of ROTINAS) {
      r.fn().catch((e) => console.error(`[${r.nome}] varredura falhou`, e));
    }
  };

  setTimeout(rodar, 60_000);
  g.__varreduraReembolsos = setInterval(rodar, 10 * 60_000);
  console.log(`[varredura] ${ROTINAS.length} rotinas agendadas (10 em 10 min)`);
}
