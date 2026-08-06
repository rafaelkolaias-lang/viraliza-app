import "server-only";

import { prisma } from "@/lib/prisma";
import { enviarAssinaturaVencendo } from "@/lib/email";

/**
 * Aviso de "sua assinatura vence em N dias", disparado pela varredura periódica
 * (ver instrumentation.ts). Roda sozinho: ninguém precisa apertar nada.
 *
 * Duas decisões que evitam e-mail errado, que aqui é pior do que e-mail nenhum:
 *
 * 1. SÓ AVISA QUEM A GENTE TEM CERTEZA DO ESTADO. Assinante com
 *    `mpAssinaturaId` renova sozinho; com `mpAssinaturaCanceladaEm` o acesso
 *    acaba; com `assinaturaPix` o acesso acaba também, porque Pix não tem
 *    cobrança automática. Quem não tem nenhum dos três veio da Cakto, e como a
 *    Cakto também renova sozinha, dizer "seu acesso vai acabar" faria a pessoa
 *    pagar de novo sem precisar.
 *
 * 2. UM AVISO POR CICLO. O `avisoVencimentoAte` guarda o vencimento que já foi
 *    avisado; quando a renovação empurra a data, ele deixa de bater e o aviso
 *    volta a valer no ciclo seguinte. Sem isso a varredura de 10 em 10 minutos
 *    mandaria o mesmo e-mail seis vezes por hora.
 */

const DIA_MS = 86_400_000;
const DIAS_AVISO = 3;

const fmtData = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "long",
  year: "numeric",
});

export async function avisarAssinaturasVencendo(): Promise<number> {
  const agora = new Date();
  const limite = new Date(agora.getTime() + DIAS_AVISO * DIA_MS);

  const contas = await prisma.user.findMany({
    where: {
      assinante: true,
      // vence dentro da janela e ainda não venceu
      assinaturaAte: { gt: agora, lte: limite },
      // só quem a gente sabe se renova ou não (ver decisão 1 acima)
      OR: [
        { mpAssinaturaId: { not: null } },
        { mpAssinaturaCanceladaEm: { not: null } },
        { assinaturaPix: true },
      ],
    },
    select: {
      id: true,
      nome: true,
      email: true,
      assinaturaAte: true,
      avisoVencimentoAte: true,
      mpAssinaturaId: true,
      assinaturaPix: true,
    },
    take: 200, // teto por passada: a varredura roda de novo em 10 min
  });

  const valorReais = parseFloat(process.env.MP_ASSINATURA_REAIS || "98.90");
  let enviados = 0;

  for (const c of contas) {
    const vence = c.assinaturaAte;
    if (!vence) continue;
    // já avisamos ESTE vencimento? (compara o instante exato)
    if (c.avisoVencimentoAte && c.avisoVencimentoAte.getTime() === vence.getTime()) continue;

    const dias = Math.ceil((vence.getTime() - agora.getTime()) / DIA_MS);
    let ok = false;
    try {
      ok = await enviarAssinaturaVencendo({
        para: c.email,
        nome: c.nome,
        dias,
        venceEm: fmtData.format(vence),
        valorReais,
        // cartão vinculado ganha prioridade: se a pessoa pagou no Pix e depois
        // colocou cartão, quem renova agora é o cartão
        renovaSozinho: !!c.mpAssinaturaId,
        pix: !c.mpAssinaturaId && c.assinaturaPix,
      });
    } catch (e) {
      console.error("[assinatura] falha ao avisar vencimento", c.id, e);
    }

    // só marca depois de enviar de verdade: se o Resend estiver fora do ar, a
    // próxima passada tenta de novo em vez de perder o aviso pra sempre
    if (ok) {
      await prisma.user.update({
        where: { id: c.id },
        data: { avisoVencimentoAte: vence },
      });
      enviados++;
    }
  }

  if (enviados) console.log(`[assinatura] ${enviados} aviso(s) de vencimento enviado(s)`);
  return enviados;
}
