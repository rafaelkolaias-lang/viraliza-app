"use client";

import { useState } from "react";
import {
  TriangleAlert,
  Lightbulb,
  ChevronDown,
  Wand2,
  Sparkles,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { EstiloCamera } from "@/lib/estilos-camera";

/**
 * Bloco "Como o produto deve aparecer" do Viraliza Lab. É a descrição da CENA
 * ESTÁTICA (a foto que depois vira vídeo). Existe porque a foto do produto quase
 * sempre tem coisa demais (várias cores, kit, modelo original, fundo cheio): sem
 * dizer o que interessa, a IA inventa itens a mais ou põe o produto torto.
 */

const MIN = 15;
const MAX = 500;

/** Sugestão de partida conforme o estilo de câmera escolhido. */
const SUGESTAO: Record<string, string> = {
  de_frente:
    "Segurando o produto com as duas mãos na altura do peito, rótulo virado para a câmera",
  selfie: "Segurando o produto ao lado do rosto, sorrindo para a câmera do celular",
  maos: "Apenas as mãos aparecem, segurando o produto e demonstrando como usar",
  vestindo: "Vestindo o produto, de corpo inteiro, mostrando como fica no corpo",
  espelho: "Vestindo o produto e tirando selfie no espelho, corpo inteiro no reflexo",
};

const EXEMPLOS = [
  {
    caso: "Produto único",
    texto: "Segurando o produto em pé, com a frente virada pra câmera",
  },
  {
    caso: "Kit (várias unidades)",
    texto: "Mostrando as peças do kit lado a lado, todas viradas de frente",
  },
  {
    caso: "Roupa com modelo na foto",
    texto: "A peça vestida no avatar, sem mostrar a modelo original da foto",
  },
  {
    caso: "Foto com vários itens",
    texto: "Apenas o produto principal em foco, sem os outros itens do fundo",
  },
];

/** Perguntas rápidas do assistente: viram o "detalhe" que a IA usa pra escrever. */
const PERGUNTAS = [
  {
    chave: "destaque",
    titulo: "O que precisa aparecer com destaque?",
    opcoes: [
      "O produto inteiro, bem visível",
      "O rótulo ou a estampa virados pra câmera",
      "O detalhe de perto (textura, acabamento)",
      "Como fica no corpo",
    ],
  },
  {
    chave: "extras",
    titulo: "A foto do produto tem mais de um item ou cor?",
    opcoes: [
      "Tem várias cores: usar só uma",
      "É um kit: mostrar as peças lado a lado",
      "Tem outra modelo na foto: não usar ela",
      "Não, é um produto só",
    ],
  },
] as const;

export function LabCena({
  estilo,
  produtoTitulo,
  valor,
  onMudar,
  sugestaoBase,
}: {
  estilo: EstiloCamera;
  produtoTitulo?: string;
  valor: string;
  onMudar: (v: string) => void;
  /** troca a sugestão do estilo (usado pela variação do POV) */
  sugestaoBase?: string;
}) {
  const [dicasAbertas, setDicasAbertas] = useState(false);
  const [assistenteAberto, setAssistenteAberto] = useState(false);
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [gerando, setGerando] = useState(false);
  const faltam = MIN - valor.trim().length;
  const sugestao = sugestaoBase ?? SUGESTAO[estilo.chave] ?? SUGESTAO.de_frente;

  async function pedirAjuda() {
    if (!produtoTitulo) {
      toast.error("Escolha o produto antes.");
      return;
    }
    setGerando(true);
    try {
      const detalhe = Object.values(respostas).filter(Boolean).join("; ");
      const r = await fetch("/api/lab/cena", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ produto: produtoTitulo, estilo: estilo.chave, detalhe }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.erro ?? "Não consegui escrever agora.");
      onMudar(String(d.texto ?? "").slice(0, MAX));
      toast.success("Pronto! Pode ajustar do seu jeito.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não consegui escrever agora.");
    } finally {
      setGerando(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Descreva exatamente como o produto e o avatar devem estar posicionados na
        imagem. Isso define a cena e evita imagens bugadas.
      </p>

      {/* Assistente: em vez de encarar um campo em branco, a pessoa responde 2
          perguntas e a IA escreve a descrição (de graça, não gasta crédito). */}
      <div className="overflow-hidden rounded-xl border border-primary/30 bg-primary/8">
        <button
          type="button"
          onClick={() => setAssistenteAberto((a) => !a)}
          className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm font-medium transition-colors hover:bg-primary/10"
        >
          <Sparkles className="size-4 text-primary" />
          Não sabe o que escrever? A IA escreve pra você
          <ChevronDown
            className={cn(
              "ml-auto size-4 text-muted-foreground transition-transform",
              assistenteAberto && "rotate-180",
            )}
          />
        </button>
        {assistenteAberto && (
          <div className="space-y-3 border-t border-primary/20 p-3.5">
            {PERGUNTAS.map((p) => (
              <div key={p.chave} className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">{p.titulo}</p>
                <div className="flex flex-wrap gap-1.5">
                  {p.opcoes.map((o) => {
                    const ativo = respostas[p.chave] === o;
                    return (
                      <button
                        key={o}
                        type="button"
                        onClick={() =>
                          setRespostas((r) => ({ ...r, [p.chave]: ativo ? "" : o }))
                        }
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                          ativo
                            ? "border-primary bg-primary/15 text-primary"
                            : "border-border/60 text-muted-foreground hover:border-primary/40 hover:text-foreground",
                        )}
                      >
                        {o}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={pedirAjuda}
              disabled={gerando}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {gerando ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              Escrever a descrição
            </button>
            <p className="text-[11px] text-muted-foreground">
              Pode responder só o que quiser: o resto a IA decide. Isso não gasta
              créditos.
            </p>
          </div>
        )}
      </div>

      <div className="relative">
        <textarea
          value={valor}
          onChange={(e) => onMudar(e.target.value.slice(0, MAX))}
          rows={3}
          maxLength={MAX}
          placeholder={sugestao}
          className="w-full resize-y rounded-xl border border-border bg-background p-3 text-sm outline-none focus:border-primary/60"
        />
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <button
            type="button"
            onClick={() => onMudar(sugestao)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            <Wand2 className="size-3.5" />
            Usar sugestão do estilo {estilo.label}
          </button>
          <span
            className={cn(
              "tabular-nums",
              faltam > 0 ? "text-amber-400" : "text-muted-foreground",
            )}
          >
            {faltam > 0
              ? `faltam ${faltam} caractere${faltam > 1 ? "s" : ""}`
              : `${valor.length}/${MAX}`}
          </span>
        </div>
      </div>

      <div className="flex gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-200 sm:text-[13px]">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" />
        <p>
          <strong>Importante:</strong> descreva a POSIÇÃO, não o produto. Ele sai
          igualzinho à foto que você escolheu, então não precisa (e não deve) dizer
          cor, tecido ou modelo: se a descrição disser algo diferente da foto, a IA
          muda o produto. Se a foto tiver vários itens ou cores, diga qual usar.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/60">
        <button
          type="button"
          onClick={() => setDicasAbertas((a) => !a)}
          className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm font-medium transition-colors hover:bg-accent/40"
        >
          <Lightbulb className="size-4 text-primary" />
          Como descrever bem
          <ChevronDown
            className={cn(
              "ml-auto size-4 text-muted-foreground transition-transform",
              dicasAbertas && "rotate-180",
            )}
          />
        </button>
        {dicasAbertas && (
          <div className="space-y-2 border-t border-border/60 p-3.5">
            {EXEMPLOS.map((ex) => (
              <button
                key={ex.caso}
                type="button"
                onClick={() => onMudar(ex.texto)}
                className="flex w-full flex-col gap-0.5 rounded-lg border border-border/50 p-2.5 text-left transition-colors hover:border-primary/40 hover:bg-accent/30"
              >
                <span className="text-[11px] font-semibold uppercase tracking-wide text-primary/80">
                  {ex.caso}
                </span>
                <span className="text-[13px] text-muted-foreground">"{ex.texto}"</span>
              </button>
            ))}
            <p className="pt-1 text-xs text-muted-foreground">
              Quanto mais específico, melhor: diga a posição do produto, o ângulo, o
              que precisa aparecer e o que deve ficar de fora.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
