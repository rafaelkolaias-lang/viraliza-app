import "server-only";

import fs from "node:fs";
import path from "node:path";

/**
 * ERROS QUE ACONTECEM FORA DO RENDER.
 *
 * O painel de Diagnóstico sempre soube mostrar vídeo que falhou (`Job.erro`),
 * porque ali existe um job pra carregar a mensagem. Só que a parte mais nova do
 * Editor falha ANTES de o job existir: a IA que descreve as cenas e a que
 * posiciona elas na linha do tempo rodam na etapa de montagem, e quando uma
 * delas quebra a pessoa vê um aviso vermelho na tela e o dono não fica sabendo
 * de nada. Como agora **nenhum erro deixa o vídeo ser gerado** (decisão do dono,
 * 06/08/2026), esse silêncio viraria "o site não deixa eu gerar" sem pista
 * nenhuma de por quê.
 *
 * Guardado em ARQUIVO e não em tabela nova de propósito: nenhuma IA altera o
 * banco sem permissão (`RULES.md`), e o projeto já guarda coisa assim em
 * `data/` (ver `materiais.ts`, `virais.json`, `produtos.json`). A pasta `data`
 * é volume no EasyPanel, então o registro sobrevive a redeploy.
 */

export const ERROS_JSON = path.join(process.cwd(), "data", "erros-app.json");

/** Quantos erros ficam guardados. É diagnóstico, não auditoria: o que importa é
 *  o que está quebrando AGORA, e um arquivo sem teto cresce pra sempre. */
const MAX_ERROS = 300;

/** De onde veio a falha. Vira a etiqueta que o admin lê no painel. */
export type AreaErro =
  | "editor-posicionar"
  | "editor-descrever-cenas"
  | "outro";

export const AREA_ROTULO: Record<AreaErro, string> = {
  "editor-posicionar": "Editor: posicionar cenas",
  "editor-descrever-cenas": "Editor: descrever cenas",
  outro: "Outro",
};

export type ErroApp = {
  /** ISO, pra ordenar e mostrar */
  em: string;
  area: AreaErro;
  /** o que a pessoa viu na tela */
  mensagem: string;
  /** detalhe técnico (resposta da API, exceção...), quando houver */
  detalhe?: string;
  userId?: string;
  /** nome/e-mail de quem estava usando, pra não precisar cruzar id na mão */
  quem?: string;
};

function ler(): ErroApp[] {
  try {
    const arr = JSON.parse(fs.readFileSync(ERROS_JSON, "utf8")) as ErroApp[];
    if (Array.isArray(arr)) return arr;
  } catch {
    // sem arquivo ainda: primeira falha cria
  }
  return [];
}

/**
 * Anota uma falha pro painel de Diagnóstico.
 *
 * NUNCA levanta exceção: quem chama está justamente tratando um erro, e falhar
 * ao registrar a falha (disco cheio, pasta somente leitura) não pode virar um
 * segundo erro por cima do primeiro.
 */
export function registrarErroApp(erro: Omit<ErroApp, "em"> & { em?: string }) {
  try {
    const lista = ler();
    lista.unshift({
      em: erro.em ?? new Date().toISOString(),
      area: erro.area,
      mensagem: String(erro.mensagem ?? "").slice(0, 500),
      ...(erro.detalhe ? { detalhe: String(erro.detalhe).slice(0, 2000) } : {}),
      ...(erro.userId ? { userId: erro.userId } : {}),
      ...(erro.quem ? { quem: String(erro.quem).slice(0, 120) } : {}),
    });
    fs.mkdirSync(path.dirname(ERROS_JSON), { recursive: true });
    fs.writeFileSync(ERROS_JSON, JSON.stringify(lista.slice(0, MAX_ERROS)), "utf8");
  } catch {
    // registrar o erro nunca pode quebrar quem já está tratando um erro
  }
}

/** Os erros mais recentes primeiro (o arquivo já é gravado nessa ordem). */
export function listarErrosApp(limite = 50): ErroApp[] {
  return ler().slice(0, Math.max(1, limite));
}
