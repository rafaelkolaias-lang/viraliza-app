import "server-only";

import { prisma } from "@/lib/prisma";
import {
  cenarioFrutaPorChave,
  cenariosDoFormato,
  formatoPorChave,
  frutaPorChave,
  historinhaDe,
  historinhaPorChave,
  type FrutaPersonagem,
  type Historinha,
} from "@/lib/viral-boost";

/**
 * Resolve o pedido do Viral Boost: descobre o formato, monta o elenco (o nosso
 * mais os personagens que a pessoa subiu) e a historinha (uma das nossas ou a
 * que ela escreveu). As duas rotas, da cena e do vídeo, entram por aqui pra não
 * repetir validação nem regra.
 */

export type CorpoBoost = {
  formato?: string;
  historinha?: string;
  frutas?: string[]; // chave da casa ou "meu-<id>"
  cenario?: string;
  /** historinha escrita pela pessoa */
  propria?: {
    nome?: string;
    sinopse?: string;
    tom?: string;
    batidas?: { rotulo?: string; acao?: string; fala?: string }[];
  };
};

export type BoostResolvido = {
  h: Historinha;
  frutas: FrutaPersonagem[];
  cenario: string;
  formato: string;
};

/** Personagens do usuário no formato de elenco (a foto vira a referência). */
export async function meusPersonagens(userId: string): Promise<FrutaPersonagem[]> {
  const rows = await prisma.personagemUsuario.findMany({
    where: { userId },
    orderBy: { criadoEm: "desc" },
    take: 60,
  });
  return rows.map((p) => ({
    chave: `meu-${p.id}`,
    nome: p.nome,
    genero: p.genero === "m" ? "m" : "f",
    jeito: p.jeito,
    imagem: p.imagemUrl,
    formato: p.formato,
    meu: true,
  }));
}

export async function resolverBoost(
  body: CorpoBoost,
  userId: string,
): Promise<{ ok: true; dados: BoostResolvido } | { ok: false; erro: string }> {
  const formato = formatoPorChave(body.formato).chave;
  const chaves = (Array.isArray(body.frutas) ? body.frutas : []).slice(0, 3);
  if (!chaves.length) return { ok: false, erro: "Escolha ao menos um personagem." };

  const meus = chaves.some((c) => c.startsWith("meu-")) ? await meusPersonagens(userId) : [];
  const frutas = chaves
    .map((c) => (c.startsWith("meu-") ? meus.find((m) => m.chave === c) : frutaPorChave(c)))
    .filter((f): f is FrutaPersonagem => !!f);
  if (frutas.length !== chaves.length) {
    return { ok: false, erro: "Não encontrei algum dos personagens escolhidos." };
  }
  // a tela já separa por formato, mas quem protege o contrato é o servidor: sem
  // isso dava pra pedir a Dona Cida numa historinha de fruta e gerar lixo pago
  if (frutas.some((f) => (f.formato ?? "frutas") !== formato)) {
    return { ok: false, erro: "Esse personagem não é desse formato." };
  }

  // historinha: uma das nossas ou a que a pessoa escreveu
  let h: Historinha | null = null;
  if (body.historinha === "propria" && body.propria) {
    const batidas = (body.propria.batidas ?? []).slice(0, 3).map((b, i) => ({
      rotulo: String(b?.rotulo ?? ["Abertura", "Clímax", "Chamada"][i]).slice(0, 40),
      acao: String(b?.acao ?? "").trim().slice(0, 300),
      fala: String(b?.fala ?? "").trim().slice(0, 200),
    }));
    if (batidas.length !== 3 || batidas.some((b) => !b.fala)) {
      return { ok: false, erro: "A sua historinha precisa das três falas." };
    }
    h = historinhaDe(
      {
        nome: String(body.propria.nome ?? "").slice(0, 80),
        sinopse: String(body.propria.sinopse ?? "").slice(0, 300),
        tom: String(body.propria.tom ?? "").slice(0, 120),
        batidas,
      },
      frutas.length,
      formato,
    );
  } else {
    h = historinhaPorChave(body.historinha);
    if (h && h.frutas !== frutas.length) {
      return { ok: false, erro: `Essa historinha precisa de ${h.frutas} personagem(ns).` };
    }
  }
  if (!h) return { ok: false, erro: "Escolha a historinha." };

  // idem pro cenário: quintal de fruta não vale no formato senhora
  const cen = cenarioFrutaPorChave(body.cenario);
  const cenario = cenariosDoFormato(formato).some((c) => c.chave === cen.chave)
    ? cen.chave
    : cenariosDoFormato(formato)[0].chave;

  return { ok: true, dados: { h, frutas, cenario, formato } };
}
