import "server-only";

import { getCarteira } from "@/lib/creditos";
import { getDividaCentavos } from "@/lib/niveis";
import { contarVideosDoUsuario } from "@/lib/jobs";
import { nomeDaRota, ROTAS_VALIDAS } from "@/lib/suporte-base";

/**
 * O ESTADO da pessoa que está perguntando, em texto, pro robô de suporte.
 *
 * Era o buraco de verdade do chat (12/08/2026). O material nunca faltou - o
 * prompt carrega a Central de Ajuda inteira -, mas o robô não sabia NADA de quem
 * estava do outro lado. Quem perguntava "por que não consigo gerar?" recebia a
 * regra geral, quando a resposta certa era "seu saldo está em 0" ou "sua
 * assinatura venceu dia 3". Tudo isto o layout do painel já consulta a cada
 * abertura de página, então não é consulta nova no sistema, é consulta nova
 * nesta rota.
 *
 * **Vai no FIM do prompt de sistema, nunca no começo.** O cache da OpenAI casa
 * por prefixo: o material fixo na frente fica cacheado a $0,025/1M, e só este
 * pedacinho variável paga preço cheio. Invertendo, a conta decuplica.
 *
 * Só entra o que ajuda a responder. E-mail, id e telefone ficam de fora de
 * propósito: não servem pra nenhuma resposta e é dado indo pra fora de casa à
 * toa.
 */

const fmtDia = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

/** Onde a pessoa está agora, em nome de tela. Rota conhecida vira nome bonito;
 *  desconhecida (`/painel/videos/abc`) fica de fora - meio caminho não ajuda. */
function telaAtual(rota?: string): string | null {
  if (!rota) return null;
  const limpa = rota.trim().slice(0, 64);
  if (!limpa.startsWith("/painel") && !limpa.startsWith("/admin")) return null;
  if (ROTAS_VALIDAS.has(limpa)) return nomeDaRota(limpa);
  return null;
}

export async function contextoDoUsuario(
  user: { id: string; nome: string; role: string },
  rota?: string,
): Promise<string> {
  const [carteira, divida, videos] = await Promise.all([
    getCarteira(user.id),
    getDividaCentavos(user.id),
    contarVideosDoUsuario(user.id),
  ]);

  const linhas: string[] = [];
  const primeiroNome = user.nome.trim().split(/\s+/)[0] || "";
  if (primeiroNome) linhas.push(`Nome: ${primeiroNome}`);

  // 1 crédito = 1 centavo (ver lib/creditos): o saldo em centavos JÁ é o número
  // de créditos, não divida por 100 aqui
  linhas.push(`Saldo: ${carteira.saldoCentavos} créditos`);

  const venceu =
    !!carteira.assinaturaAte && carteira.assinaturaAte.getTime() <= Date.now();
  if (user.role === "admin" || user.role === "demo") {
    linhas.push(`Assinatura: conta ${user.role}, tem acesso a tudo`);
  } else if (!carteira.assinante) {
    linhas.push("Assinatura: NÃO tem. A biblioteca está travada pra ela.");
  } else if (venceu) {
    linhas.push(
      `Assinatura: VENCIDA em ${fmtDia.format(carteira.assinaturaAte!)}. A biblioteca está travada até renovar.`,
    );
  } else if (carteira.assinaturaAte) {
    linhas.push(`Assinatura: ativa, vence em ${fmtDia.format(carteira.assinaturaAte)}`);
  } else {
    linhas.push("Assinatura: ativa, sem data de vencimento");
  }

  linhas.push(`Vídeos: ${videos.prontos} prontos, ${videos.emProducao} em produção`);

  if (divida > 0) {
    linhas.push(
      `ATENÇÃO: tem ${divida} créditos de saldo devedor de reembolso. A conta não gera vídeo até comprar crédito de novo, o que quita sozinho.`,
    );
  }

  const tela = telaAtual(rota);
  if (tela) linhas.push(`Tela aberta agora: ${tela}`);

  return `=== QUEM ESTÁ PERGUNTANDO (dados de AGORA) ===
${linhas.join("\n")}

Estes números valem mais que o material: são a conta desta pessoa, neste instante.
- Quando a pergunta for sobre a situação DELA ("posso gerar?", "por que travou?", "quanto tenho?"), responda com o número concreto acima, não com a regra geral.
- Nunca despeje esta lista inteira; use só o dado que responde a pergunta.
- Não invente nada que não esteja aqui: se ela perguntar algo da conta que não está nesta lista (cobrança, estorno, vídeo sumido), siga a REGRA 4 e mande pra tela de Sugestões.`;
}
