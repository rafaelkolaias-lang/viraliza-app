/**
 * Roda UMA vez quando o servidor Next sobe (next start). Agenda a varredura
 * de reembolsos na Cakto e na Kiwify: nenhuma das duas manda webhook de
 * "reembolso solicitado", então a cada 10 min a gente confere as vendas recentes
 * e suspende/restaura os créditos conforme o status.
 */
export async function register() {
  // só no servidor Node (não roda no edge nem no build do cliente)
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const g = globalThis as { __varreduraReembolsos?: ReturnType<typeof setInterval> };
  if (g.__varreduraReembolsos) return; // evita timer duplicado em hot-reload

  const { verificarReembolsos, verificarReembolsosCakto } = await import("@/lib/reembolsos");
  const { aplicarLiberacoesVencidas } = await import("@/lib/liberacao-creditos");
  const { avisarAssinaturasVencendo } = await import("@/lib/avisos-assinatura");
  const rodar = () => {
    verificarReembolsosCakto().catch((e) =>
      console.error("[reembolsos] varredura Cakto falhou", e),
    );
    verificarReembolsos().catch((e) =>
      console.error("[reembolsos] varredura Kiwify falhou", e),
    );
    // crédito comprado em quarentena cujo 8º dia chegou: cai no saldo
    aplicarLiberacoesVencidas().catch((e) =>
      console.error("[liberacao] varredura falhou", e),
    );
    // assinatura vencendo em 3 dias: manda o e-mail de aviso (1 por ciclo)
    avisarAssinaturasVencendo().catch((e) =>
      console.error("[assinatura] varredura de vencimento falhou", e),
    );
  };

  // primeira passada ~1 min depois do boot (deixa o app estabilizar), depois a cada 10 min
  setTimeout(rodar, 60_000);
  g.__varreduraReembolsos = setInterval(rodar, 10 * 60_000);
  console.log("[reembolsos] varredura periódica agendada (10 em 10 min)");
}
