"use client";

import { useEffect, useRef, useState } from "react";
import {
  BedDouble,
  Check,
  Frame,
  Home,
  Lamp,
  Umbrella,
  Sun,
  Sparkles,
  Gamepad2,
  Building2,
  MonitorSmartphone,
  Joystick,
  Warehouse,
  Zap,
  Moon,
  Trees,
  Mountain,
  Sunset,
  Tv,
  Dumbbell,
  PencilLine,
  Upload,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { midiaCenario } from "@/lib/lab-midia";
import { normalizarImagem, ERRO_IMAGEM } from "@/lib/imagem-cliente";
import type { CenarioMeu } from "@/lib/cenarios-usuario";

/**
 * Passo "Cenário" do Viraliza Lab: onde a cena acontece. Todo cenário é um card
 * com FOTO (decisão do Lucas em 04/ago/2026: sem cards de ícone; cenário sem
 * foto sai da lista). As exceções são "Descrever outro" (escrever à mão) e
 * "Subir meu cenário" (a pessoa manda a foto do ambiente DELA — vira a chave
 * "meu:<id>", salva na conta, só ela vê; a foto vai como referência de lugar
 * pro motor).
 *
 * As fotos da plataforma moram em media.univershoop.com/lab/cenarios/<chave>.jpg
 * (serverrk, fora do repo): trocar/adicionar foto é só scp, sem deploy. A
 * descrição em inglês que vai pro prompt fica no CENARIO_LIVRE de
 * /api/lab/imagem (ou no CENARIO_MOTOR quando existe equivalente no motor).
 */

export type CenarioLab = {
  chave: string;
  label: string;
  Icone: typeof BedDouble;
  motor?: string; // chave de CENARIOS
};

export const CENARIOS_LAB: CenarioLab[] = [
  // casas brasileiras REAIS (as fotos de referência do Lucas em docs/referencias/,
  // as mesmas que deram origem às descrições do motor em avatar-modelo.ts)
  { chave: "casa", label: "Casa", Icone: Home, motor: "sala" },
  { chave: "casa_simples", label: "Casa simples", Icone: Warehouse, motor: "sala_tijolo" },
  { chave: "ar_livre", label: "Quintal", Icone: Sun, motor: "quintal" },
  { chave: "quarto", label: "Quarto", Icone: BedDouble, motor: "quarto" },
  // academias (fotos reais de referência, estilos diferentes)
  { chave: "academia", label: "Academia", Icone: Dumbbell },
  { chave: "academia_mov", label: "Academia movimentada", Icone: Dumbbell },
  { chave: "academia_escura", label: "Academia escura", Icone: Dumbbell },
  { chave: "academia_amarela", label: "Academia amarela", Icone: Dumbbell },
  { chave: "academia_verde", label: "Academia verde", Icone: Dumbbell },
  { chave: "quarto_clean", label: "Quarto clean", Icone: Sparkles },
  { chave: "quarto_tv", label: "Quarto com TV", Icone: Tv },
  { chave: "gamer_rgb", label: "Quarto gamer", Icone: Gamepad2 },
  { chave: "gamer_azul", label: "Setup gamer azul", Icone: Joystick },
  { chave: "neon_roxo", label: "Quarto neon", Icone: Zap },
  { chave: "estudio_neon", label: "Estúdio neon", Icone: Moon },
  { chave: "galeria", label: "Quadros na parede", Icone: Frame },
  { chave: "camarim", label: "Camarim", Icone: Lamp },
  { chave: "loja_tech", label: "Loja de eletrônicos", Icone: MonitorSmartphone },
  { chave: "cidade", label: "Centro da cidade", Icone: Building2 },
  { chave: "parque", label: "Parque", Icone: Trees },
  { chave: "varanda", label: "Varanda com vista", Icone: Mountain },
  { chave: "por_do_sol", label: "Pôr do sol", Icone: Sunset },
  { chave: "resort", label: "Resort paradisíaco", Icone: Umbrella },
  // "Outros" = descrever à mão (único sem foto de propósito)
  { chave: "outros", label: "Outros", Icone: PencilLine },
];

/** Card de cenário com foto (mesma moldura pros da plataforma e pros da pessoa). */
function CardFoto({
  src,
  label,
  ativo,
  onEscolher,
  etiqueta,
  Fallback,
}: {
  src: string;
  label: string;
  ativo: boolean;
  onEscolher: () => void;
  etiqueta?: string;
  Fallback: typeof BedDouble;
}) {
  return (
    <button
      type="button"
      onClick={onEscolher}
      aria-pressed={ativo}
      className={cn(
        "group relative aspect-[3/4] overflow-hidden rounded-xl border text-left transition-all",
        ativo ? "border-primary ring-2 ring-primary/40" : "border-border/60 hover:border-primary/40",
      )}
    >
      {/* ícone por baixo: aparece só se a foto falhar de carregar */}
      <span className="absolute inset-0 grid place-items-center bg-card/60 text-muted-foreground">
        <Fallback className="size-6" />
      </span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={label}
        loading="lazy"
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
        className="absolute inset-0 size-full object-cover transition-transform duration-300 group-hover:scale-105"
      />
      {etiqueta && (
        <span className="absolute left-1.5 top-1.5 rounded-full bg-primary/90 px-2 py-0.5 text-[10px] font-bold text-primary-foreground shadow">
          {etiqueta}
        </span>
      )}
      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent pb-1.5 pt-8" />
      <span className="absolute inset-x-0 bottom-0 px-2.5 pb-2 text-xs font-semibold leading-tight text-white drop-shadow sm:text-sm">
        {label}
      </span>
      {ativo && (
        <span className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg">
          <Check className="size-3.5" />
        </span>
      )}
    </button>
  );
}

export function LabCenario({
  escolhido,
  textoLivre,
  onEscolher,
  onTextoLivre,
}: {
  escolhido: string | null;
  textoLivre: string;
  onEscolher: (chave: string) => void;
  onTextoLivre: (t: string) => void;
}) {
  // cenários que a PESSOA subiu (só dela): entram no topo da grade
  const [meus, setMeus] = useState<CenarioMeu[]>([]);
  const [subindo, setSubindo] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/cenarios", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setMeus(d?.cenarios ?? []))
      .catch(() => {});
  }, []);

  async function subir(file?: File | null) {
    if (!file) return;
    setSubindo(true);
    try {
      const dataUrl = await normalizarImagem(file);
      if (!dataUrl) throw new Error(ERRO_IMAGEM);
      const nome = file.name.replace(/\.[^.]+$/, "").slice(0, 60) || "Meu cenário";
      const r = await fetch("/api/cenarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, foto: dataUrl }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.erro ?? "Falha ao subir o cenário.");
      setMeus((l) => [d.cenario, ...l]);
      onEscolher(`meu:${d.cenario.id}`); // já deixa selecionado
      toast.success("Cenário salvo! Ele fica guardado na sua conta.");
    } catch (e) {
      toast.error(
        e instanceof Error && e.message === ERRO_IMAGEM
          ? "Não consegui ler essa imagem. Tente outra foto (JPG ou PNG)."
          : e instanceof Error
            ? e.message
            : "Falha ao subir o cenário.",
      );
    } finally {
      setSubindo(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Onde a cena acontece: o cenário sai nítido e igualzinho ao que você
        escolher. Você também pode subir a foto de um ambiente seu.
      </p>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        {/* SUBIR O PRÓPRIO CENÁRIO: salva na conta (só a pessoa vê) e já seleciona */}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={subindo}
          className="flex aspect-[3/4] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-primary/50 bg-primary/5 px-3 text-sm font-medium text-primary transition-all hover:border-primary hover:bg-primary/10 disabled:opacity-60"
        >
          {subindo ? <Loader2 className="size-6 animate-spin" /> : <Upload className="size-6" />}
          {subindo ? "Subindo..." : "Subir meu cenário"}
          <span className="text-[11px] font-normal text-muted-foreground">
            Foto de um ambiente seu
          </span>
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => subir(e.target.files?.[0])}
        />

        {/* os cenários que a pessoa subiu (só dela) */}
        {meus.map((c) => (
          <CardFoto
            key={c.id}
            src={c.imagemUrl}
            label={c.nome}
            etiqueta="Seu"
            ativo={escolhido === `meu:${c.id}`}
            onEscolher={() => onEscolher(`meu:${c.id}`)}
            Fallback={Home}
          />
        ))}

        {/* cenários da plataforma */}
        {CENARIOS_LAB.map(({ chave, label, Icone }) => {
          const ativo = escolhido === chave;

          // "Outros": card de descrever o cenário à mão (sem foto de propósito)
          if (chave === "outros") {
            return (
              <button
                key={chave}
                type="button"
                onClick={() => onEscolher(chave)}
                aria-pressed={ativo}
                className={cn(
                  "flex aspect-[3/4] flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-3 text-sm font-medium transition-all",
                  ativo
                    ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/30"
                    : "border-border text-muted-foreground hover:border-primary/40 hover:bg-card hover:text-foreground",
                )}
              >
                <Icone className="size-6" />
                Descrever outro
                <span className="text-[11px] font-normal text-muted-foreground">
                  Você escreve o cenário
                </span>
              </button>
            );
          }

          return (
            <CardFoto
              key={chave}
              src={midiaCenario(chave)}
              label={label}
              ativo={ativo}
              onEscolher={() => onEscolher(chave)}
              Fallback={Icone}
            />
          );
        })}
      </div>

      {escolhido === "outros" && (
        <input
          value={textoLivre}
          onChange={(e) => onTextoLivre(e.target.value.slice(0, 160))}
          maxLength={160}
          placeholder="Descreva o cenário (ex: em uma varanda com plantas, no fim da tarde)"
          className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary/60"
        />
      )}
    </div>
  );
}
