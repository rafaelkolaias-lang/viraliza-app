import "server-only";

import { prisma } from "@/lib/prisma";

export interface Lead {
  lugar_id: string;
  nome: string;
  categoria: string;
  telefone: string;
  site: string;
  tem_site: string;
  email: string;
  instagram: string;
  whatsapp: string;
  rede_social: string;
  nota: number | null;
  total_avaliacoes: number;
  score_lead: number;
  oportunidades: string;
  mensagem_sugerida: string;
  endereco: string;
  google_maps: string;
  cidade: string;
  nicho: string;
  uf: string;
}

/** Extrai a UF do endereço (ex: "..., São Bernardo do Campo - SP, 09725-170"). */
function ufDoEndereco(endereco: string): string {
  const m = / - ([A-Z]{2})[,\s]/.exec(endereco || "");
  return m ? m[1] : "";
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Chave estável pra deduplicar (lugar_id, ou nome|cidade quando vazio). */
export function chaveDe(l: { lugar_id?: string; nome: string; cidade?: string }): string {
  return l.lugar_id || `${l.nome}|${l.cidade ?? ""}`;
}

/** Converte um lead cru (saída do scraper) no nosso tipo Lead. */
export function mapearLead(l: Record<string, unknown>): Lead {
  const str = (k: string) => (l[k] == null ? "" : String(l[k]));
  return {
    lugar_id: str("lugar_id"),
    nome: str("nome"),
    categoria: str("categoria"),
    telefone: str("telefone"),
    site: str("site"),
    tem_site: str("tem_site"),
    email: str("email"),
    instagram: str("instagram"),
    whatsapp: str("whatsapp"),
    rede_social: str("rede_social"),
    nota: l.nota === "" || l.nota == null ? null : Number(l.nota),
    total_avaliacoes: num(l.total_avaliacoes),
    score_lead: num(l.score_lead),
    oportunidades: str("oportunidades"),
    mensagem_sugerida: str("mensagem_sugerida"),
    endereco: str("endereco"),
    google_maps: str("google_maps"),
    cidade: str("cidade"),
    nicho: str("nicho"),
    uf: ufDoEndereco(str("endereco")),
  };
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Linha do banco -> nosso tipo Lead. */
function dbParaLead(r: any): Lead {
  return {
    lugar_id: r.lugarId ?? "",
    nome: r.nome ?? "",
    categoria: r.categoria ?? "",
    telefone: r.telefone ?? "",
    site: r.site ?? "",
    tem_site: r.site ? "sim" : "não",
    email: r.email ?? "",
    instagram: r.instagram ?? "",
    whatsapp: r.whatsapp ?? "",
    rede_social: r.redeSocial ?? "",
    nota: r.nota,
    total_avaliacoes: r.totalAvaliacoes ?? 0,
    score_lead: r.scoreLead ?? 0,
    oportunidades: r.oportunidades ?? "",
    mensagem_sugerida: r.mensagem ?? "",
    endereco: r.endereco ?? "",
    google_maps: r.googleMaps ?? "",
    cidade: r.cidade ?? "",
    nicho: r.nicho ?? "",
    uf: r.uf ?? "",
  };
}

/** Nosso tipo Lead -> dados das colunas do banco. */
function leadParaDb(l: Lead) {
  return {
    lugarId: l.lugar_id || "",
    nome: l.nome.slice(0, 255),
    categoria: (l.categoria || "").slice(0, 255),
    telefone: l.telefone || "",
    site: l.site || null,
    email: l.email || "",
    instagram: l.instagram || null,
    whatsapp: l.whatsapp || "",
    redeSocial: l.rede_social || null,
    nota: l.nota,
    totalAvaliacoes: l.total_avaliacoes || 0,
    scoreLead: l.score_lead || 0,
    oportunidades: l.oportunidades || null,
    mensagem: l.mensagem_sugerida || null,
    endereco: l.endereco || null,
    googleMaps: l.google_maps || null,
    cidade: (l.cidade || "").slice(0, 255),
    uf: (l.uf || "").slice(0, 2),
    nicho: (l.nicho || "").slice(0, 255),
  };
}

/** Lê os leads de UM usuário, do mais quente pro mais frio. */
export async function getLeads(userId: string): Promise<Lead[]> {
  try {
    const linhas = await prisma.lead.findMany({
      where: { userId },
      orderBy: { scoreLead: "desc" },
      take: 2000,
    });
    return linhas.map(dbParaLead);
  } catch {
    return [];
  }
}

/** Salva (upsert por usuário+chave) uma leva de leads. Retorna quantos foram gravados. */
export async function salvarLeads(leads: Lead[], userId: string): Promise<number> {
  let n = 0;
  for (const l of leads) {
    if (!l.nome) continue;
    const dados = leadParaDb(l);
    const chave = chaveDe(l);
    try {
      await prisma.lead.upsert({
        where: { userId_chave: { userId, chave } },
        create: { userId, chave, ...dados },
        update: dados,
      });
      n += 1;
    } catch {
      // ignora um lead problemático e segue
    }
  }
  return n;
}
