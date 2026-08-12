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
  const { limparEntradasVencidas, encerrarPreparandoPresos } = await import("@/lib/jobs");
  const rodar = () => {
    verificarReembolsosCakto().catch((e) =>
      console.error("[reembolsos] varredura Cakto falhou", e),
    );
    verificarReembolsos().catch((e) =>
      console.error("[reembolsos] varredura Kiwify falhou", e),
    );
    // crédito comprado em quarentena cujo 8º dia chegou: cai no saldo
    // (legado: compra nova entra 100% na hora desde a reforma dos níveis)
    aplicarLiberacoesVencidas().catch((e) =>
      console.error("[liberacao] varredura falhou", e),
    );
    // mídias de entrada retidas 24h pro reuso (tarefa 21): apaga as vencidas
    limparEntradasVencidas().catch((e) =>
      console.error("[uploads] limpeza de entradas falhou", e),
    );
    // job que ficou esperando um navegador que não voltou (11/08/2026): vira
    // erro pra não ocupar vaga de simultâneo pra sempre
    encerrarPreparandoPresos().catch((e) =>
      console.error("[jobs] encerramento de preparando presos falhou", e),
    );
  };

  // primeira passada ~1 min depois do boot (deixa o app estabilizar), depois a cada 10 min
  setTimeout(rodar, 60_000);
  g.__varreduraReembolsos = setInterval(rodar, 10 * 60_000);
  console.log("[reembolsos] varredura periódica agendada (10 em 10 min)");
}
