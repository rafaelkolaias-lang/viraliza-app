import "server-only";

import { prisma } from "@/lib/prisma";
import { MEDIA_BASE } from "@/lib/midia-shopee";
import { chat, extrairJSON, llmConfigurado } from "@/lib/llm";
import type { ViralVideo } from "@/lib/types";

/**
 * "Minerador" de produtos: o afiliado escreve o que quer vender em texto livre,
 * o LLM próprio (qwen) mapeia pro(s) nicho(s) do acervo, e a gente devolve os
 * vídeos virais daquele nicho pra ele usar de criativo.
 */

// nichos reais que existem no acervo (base pro LLM casar e pro fallback)
export const NICHOS = [
  "Utilidades", "Moda", "Cozinha", "Eletronicos", "Casa", "Decoração",
  "Beleza", "Maquiagens", "Perfumes", "Cosméticos", "Kids", "Pets",
  "Fitness", "Papelaria", "Acessórios", "Banheiro", "Comida",
  "Natal", "Páscoa", "Carnaval", "Copa 2026", "Dia das Maes", "Dia dos Namorados",
];

// sinônimos pro fallback sem LLM (palavra do usuário -> nicho do acervo)
const SINONIMOS: Record<string, string> = {
  cachorro: "Pets", cão: "Pets", gato: "Pets", pet: "Pets", animal: "Pets",
  academia: "Fitness", treino: "Fitness", gym: "Fitness", musculação: "Fitness",
  roupa: "Moda", roupas: "Moda", vestido: "Moda", camiseta: "Moda", moda: "Moda",
  maquiagem: "Maquiagens", batom: "Maquiagens", make: "Maquiagens",
  perfume: "Perfumes", cheiro: "Perfumes",
  cozinha: "Cozinha", panela: "Cozinha", utensilio: "Cozinha",
  casa: "Casa", decoração: "Decoração", decoracao: "Decoração",
  eletronico: "Eletronicos", eletrônico: "Eletronicos", gadget: "Eletronicos", fone: "Eletronicos",
  criança: "Kids", crianca: "Kids", bebê: "Kids", bebe: "Kids", infantil: "Kids", kids: "Kids",
  escola: "Papelaria", caderno: "Papelaria", papelaria: "Papelaria",
  beleza: "Beleza", skincare: "Beleza", pele: "Beleza",
  banheiro: "Banheiro", cozinhar: "Cozinha", comida: "Comida",
};

const SISTEMA = `Você ajuda AFILIADOS a garimpar produtos virais pra vender.
Nichos disponíveis no acervo: ${NICHOS.join(", ")}.
Dado o pedido do afiliado (texto livre), responda SOMENTE um JSON, sem nada antes ou depois:
{"nichos": ["<um ou mais nichos EXATAMENTE como na lista>"], "termo": "<resumo curto do que ele quer, 2 a 5 palavras>"}
Escolha só nichos que existam na lista. Se não bater com nenhum, use o mais próximo.`;

export type Interpretacao = { nichos: string[]; termo: string; viaIA: boolean };

/** Casa o texto com os nichos do acervo (LLM; cai no fallback por palavra-chave). */
export async function interpretarPedido(texto: string): Promise<Interpretacao> {
  const limpo = (texto || "").trim().slice(0, 300);
  if (!limpo) return { nichos: [], termo: "", viaIA: false };

  if (llmConfigurado()) {
    try {
      const raw = await chat(
        [
          { role: "system", content: SISTEMA },
          { role: "user", content: limpo },
        ],
        { temperature: 0.2, maxTokens: 200, timeoutMs: 45_000 },
      );
      const obj = extrairJSON<{ nichos?: string[]; termo?: string }>(raw);
      if (obj?.nichos?.length) {
        // valida contra a lista real (evita nicho inventado)
        const validos = obj.nichos
          .map((n) => NICHOS.find((x) => x.toLowerCase() === String(n).toLowerCase().trim()))
          .filter((n): n is string => !!n);
        if (validos.length) {
          return { nichos: [...new Set(validos)], termo: obj.termo?.trim() || limpo, viaIA: true };
        }
      }
    } catch {
      // cai no fallback abaixo
    }
  }

  // fallback: casa por palavra-chave/sinônimo
  const t = limpo.toLowerCase();
  const achados = new Set<string>();
  for (const [chave, nicho] of Object.entries(SINONIMOS)) {
    if (t.includes(chave)) achados.add(nicho);
  }
  for (const n of NICHOS) {
    if (t.includes(n.toLowerCase())) achados.add(n);
  }
  return { nichos: [...achados], termo: limpo, viaIA: false };
}

type Row = {
  id: string;
  titulo: string;
  categoria: string;
  emAlta: boolean;
  link: string | null;
  duracaoSeg: number;
  adicionadoEm: Date;
  migrado: boolean;
  driveId: string | null;
  thumbDriveId: string | null;
};

function mapear(r: Row): ViralVideo {
  const base = {
    id: r.id,
    titulo: r.titulo,
    categoria: r.categoria || undefined,
    emAlta: r.emAlta,
    link: r.link ?? undefined,
    duracaoSeg: r.duracaoSeg,
    adicionadoEm: r.adicionadoEm.toISOString(),
  };
  if (r.migrado) {
    return {
      ...base,
      arquivo: `${MEDIA_BASE}/virais/${r.id}.mp4`,
      thumb: `${MEDIA_BASE}/thumbs/${r.id}.jpg`,
    };
  }
  return { ...base, driveId: r.driveId ?? undefined, thumbDriveId: r.thumbDriveId ?? undefined };
}

/** Busca vídeos do acervo pelos nichos (título "Nicho: X" ou categoria). Em alta primeiro. */
export async function buscarVideos(
  nichos: string[],
  limite = 60,
): Promise<ViralVideo[]> {
  if (!nichos.length) return [];
  const OR = nichos.flatMap((n) => [
    { titulo: { contains: n } },
    { categoria: { contains: n } },
  ]);
  const rows = await prisma.videoShopee.findMany({
    where: { OR },
    orderBy: [{ emAlta: "desc" }, { adicionadoEm: "desc" }],
    take: Math.min(120, Math.max(1, limite)),
    select: {
      id: true, titulo: true, categoria: true, emAlta: true, link: true,
      duracaoSeg: true, adicionadoEm: true, migrado: true, driveId: true, thumbDriveId: true,
    },
  });
  // "Em alta agora": vídeo já marcado no banco, OU adicionado nos últimos 14 dias
  // (fresco = bombando), OU entre os 3 primeiros (mais relevantes do nicho).
  const corte = Date.now() - 14 * 86_400_000;
  return rows.map((r, i) => {
    const v = mapear(r);
    v.emAlta = r.emAlta || r.adicionadoEm.getTime() >= corte || i < 3;
    return v;
  });
}
