"use client";

import { useMemo, useRef, useState } from "react";
import {
  Search,
  MapPin,
  Tag,
  ChevronDown,
  Flame,
  Globe,
  X,
  Info,
  Loader2,
  Hash,
  Clock,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LeadCard } from "@/components/app/lead-card";
import { Paginacao } from "@/components/app/paginacao";
import { SETORES, ESTADOS } from "@/lib/leads-opcoes";
import { cn } from "@/lib/utils";
import type { Lead } from "@/lib/leads";

const POR_PAGINA = 24;
const QTDS = [10, 20, 50, 100, 200];

function normaliza(s: string) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, ""); // remove acentos
}

type Temp = "todos" | "quente" | "morno";

export function LeadsPainel({ leads }: { leads: Lead[] }) {
  // inputs do form
  const [nichosSel, setNichosSel] = useState<Set<string>>(new Set());
  const [cidade, setCidade] = useState("");
  const [uf, setUf] = useState("");
  const [qtd, setQtd] = useState(20);
  const [abrirNichos, setAbrirNichos] = useState(false);

  // execução da busca ao vivo
  const [rodando, setRodando] = useState(false);
  const [progresso, setProgresso] = useState<string[]>([]);
  const [erro, setErro] = useState("");

  // resultados (começa com os já garimpados como exemplo)
  const [resultado, setResultado] = useState<Lead[]>(leads);
  const [rotulo, setRotulo] = useState(
    leads.length ? "Leads já garimpados (exemplos)" : "",
  );

  // filtros sobre o resultado
  const [busca, setBusca] = useState("");
  const [temp, setTemp] = useState<Temp>("todos");
  const [soSemSite, setSoSemSite] = useState(false);
  const [pagina, setPagina] = useState(1);

  const logRef = useRef<HTMLDivElement>(null);

  function toggleNicho(n: string) {
    setNichosSel((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });
  }

  async function pesquisar() {
    if (!cidade.trim()) {
      toast.error("Informe a cidade.");
      return;
    }
    setRodando(true);
    setErro("");
    setProgresso([]);
    setPagina(1);

    try {
      const res = await fetch("/api/leads/buscar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cidade: cidade.trim(),
          uf,
          nichos: [...nichosSel],
          qtd,
        }),
      });

      if (!res.ok || !res.body) {
        setErro((await res.text().catch(() => "")) || "Falha ao iniciar a busca.");
        setRodando(false);
        return;
      }

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let acabou = false;

      while (!acabou) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf("\n")) >= 0) {
          const linha = buf.slice(0, idx).trim();
          buf = buf.slice(idx + 1);
          if (!linha) continue;
          let ev: { type: string; msg?: string; leads?: Lead[] };
          try {
            ev = JSON.parse(linha);
          } catch {
            continue;
          }
          if (ev.type === "progress" && ev.msg) {
            setProgresso((p) => [...p.slice(-40), ev.msg as string]);
            requestAnimationFrame(() => {
              logRef.current?.scrollTo({ top: 1e9 });
            });
          } else if (ev.type === "done" && ev.leads) {
            setResultado(ev.leads);
            setRotulo(
              `${ev.leads.length} leads em ${cidade.trim()}${uf ? ` - ${uf}` : ""}`,
            );
            toast.success(`${ev.leads.length} leads encontrados!`);
            acabou = true;
          } else if (ev.type === "error") {
            setErro(ev.msg || "Erro na busca.");
            acabou = true;
          }
        }
      }
    } catch {
      setErro("Sem conexão com o robô de leads.");
    } finally {
      setRodando(false);
    }
  }

  const filtrados = useMemo(() => {
    const b = normaliza(busca);
    return resultado.filter((l) => {
      if (b && !normaliza(l.nome).includes(b)) return false;
      if (soSemSite && l.site) return false;
      if (temp === "quente" && l.score_lead < 60) return false;
      if (temp === "morno" && (l.score_lead < 30 || l.score_lead >= 60))
        return false;
      return true;
    });
  }, [resultado, busca, soSemSite, temp]);

  function baixarPlanilha() {
    if (!filtrados.length) {
      toast.info("Nada pra baixar.");
      return;
    }
    const cols: [keyof Lead, string][] = [
      ["nome", "Nome"],
      ["categoria", "Categoria"],
      ["cidade", "Cidade"],
      ["uf", "UF"],
      ["nicho", "Nicho"],
      ["telefone", "Telefone"],
      ["whatsapp", "WhatsApp"],
      ["email", "E-mail"],
      ["instagram", "Instagram"],
      ["rede_social", "Rede social"],
      ["site", "Site"],
      ["nota", "Nota"],
      ["total_avaliacoes", "Avaliacoes"],
      ["score_lead", "Score"],
      ["oportunidades", "Oportunidades"],
      ["endereco", "Endereco"],
      ["google_maps", "Google Maps"],
      ["mensagem_sugerida", "Mensagem"],
    ];
    const esc = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const head = cols.map((c) => c[1]).join(";");
    const linhas = filtrados.map((l) =>
      cols.map((c) => esc(l[c[0]])).join(";"),
    );
    const csv = "﻿" + [head, ...linhas].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads_${cidade.trim().replace(/\s+/g, "-").toLowerCase() || "todos"}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success(`Planilha com ${filtrados.length} leads baixada!`);
  }

  const quentes = filtrados.filter((l) => l.score_lead >= 60).length;
  const semSite = filtrados.filter((l) => !l.site).length;

  const totalPaginas = Math.ceil(filtrados.length / POR_PAGINA);
  const paginaAtual = Math.min(pagina, Math.max(1, totalPaginas));
  const visiveis = filtrados.slice(
    (paginaAtual - 1) * POR_PAGINA,
    paginaAtual * POR_PAGINA,
  );

  const demora = qtd >= 100;

  return (
    <div className="space-y-5">
      {/* ===== FORM DE BUSCA ===== */}
      <div className="space-y-4 rounded-xl border border-border bg-card p-4">
        <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
          <div className="space-y-1.5">
            <Label htmlFor="cidade">Cidade</Label>
            <Input
              id="cidade"
              placeholder="Ex: São José dos Campos"
              value={cidade}
              onChange={(e) => setCidade(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !rodando && pesquisar()}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="uf">Estado</Label>
            <select
              id="uf"
              value={uf}
              onChange={(e) => setUf(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Todos</option>
              {ESTADOS.map((e) => (
                <option key={e.uf} value={e.uf}>
                  {e.uf} - {e.nome}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* nichos */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setAbrirNichos((v) => !v)}
            className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2.5 text-sm"
          >
            <span className="inline-flex items-center gap-2">
              <Tag className="size-4 text-primary" />
              Nichos
              {nichosSel.size > 0 ? (
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
                  {nichosSel.size} selecionado{nichosSel.size > 1 ? "s" : ""}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">
                  (vazio = garimpa todos)
                </span>
              )}
            </span>
            <ChevronDown
              className={cn(
                "size-4 text-muted-foreground transition-transform",
                abrirNichos && "rotate-180",
              )}
            />
          </button>

          {nichosSel.size > 0 && !abrirNichos && (
            <div className="flex flex-wrap gap-1.5">
              {[...nichosSel].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => toggleNicho(n)}
                  className="inline-flex items-center gap-1 rounded-full bg-primary/12 px-2.5 py-1 text-xs font-medium text-primary"
                >
                  {n}
                  <X className="size-3" />
                </button>
              ))}
            </div>
          )}

          {abrirNichos && (
            <div className="max-h-72 space-y-4 overflow-y-auto rounded-lg border border-border p-3">
              {SETORES.map(({ setor, nichos }) => (
                <div key={setor}>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">
                    {setor}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {nichos.map((n) => {
                      const ativo = nichosSel.has(n);
                      return (
                        <button
                          key={n}
                          type="button"
                          onClick={() => toggleNicho(n)}
                          className={cn(
                            "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                            ativo
                              ? "border-primary bg-primary/15 text-primary"
                              : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
                          )}
                        >
                          {n}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* quantidade */}
        <div className="space-y-1.5">
          <Label className="inline-flex items-center gap-1.5">
            <Hash className="size-3.5 text-primary" />
            Máximo de leads por nicho
          </Label>
          <div className="flex flex-wrap gap-1.5">
            {QTDS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setQtd(q)}
                className={cn(
                  "min-w-12 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                  qtd === q
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
                )}
              >
                {q}
              </button>
            ))}
          </div>
          {demora && (
            <p className="inline-flex items-center gap-1.5 text-[11px] text-amber-300/90">
              <Clock className="size-3.5" />
              Com {qtd} por nicho a busca pode <b>demorar vários minutos</b> - vai
              mostrando o progresso aqui embaixo.
            </p>
          )}
        </div>

        {/* aviso */}
        <div className="flex items-start gap-2 rounded-lg border border-sky-500/25 bg-sky-500/10 p-2.5 text-[11px] text-sky-200/90">
          <Info className="mt-0.5 size-3.5 shrink-0 text-sky-400" />
          <span>
            A busca roda <b>ao vivo no Google Maps</b> (no seu PC). Quanto mais
            nichos e leads, mais demora - o progresso aparece em tempo real.
          </span>
        </div>

        {/* botão */}
        <Button
          type="button"
          size="lg"
          className="h-11 w-full"
          onClick={pesquisar}
          disabled={rodando}
        >
          {rodando ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Search className="size-4" />
          )}
          {rodando ? "Buscando..." : "Pesquisar leads"}
        </Button>
      </div>

      {/* ===== PROGRESSO AO VIVO ===== */}
      {rodando && (
        <div className="space-y-2 rounded-xl border border-border bg-card p-4">
          <p className="inline-flex items-center gap-2 text-sm font-medium">
            <Loader2 className="size-4 animate-spin text-primary" />
            Garimpando no Google Maps...
          </p>
          <div
            ref={logRef}
            className="max-h-44 overflow-y-auto rounded-lg bg-background p-3 font-mono text-[11px] leading-relaxed text-muted-foreground"
          >
            {progresso.length === 0 ? (
              <p>Preparando o robô...</p>
            ) : (
              progresso.map((l, i) => <p key={i}>{l}</p>)
            )}
          </div>
        </div>
      )}

      {/* ===== ERRO ===== */}
      {erro && !rodando && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {erro}
        </div>
      )}

      {/* ===== RESULTADOS ===== */}
      {!rodando && resultado.length > 0 && (
        <>
          {rotulo && (
            <p className="text-sm font-medium text-muted-foreground">{rotulo}</p>
          )}

          {/* filtros rápidos */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Filtrar por nome..."
                value={busca}
                onChange={(e) => {
                  setBusca(e.target.value);
                  setPagina(1);
                }}
                className="pl-9"
              />
            </div>
            <div className="flex rounded-lg border border-border p-0.5">
              {(["todos", "quente", "morno"] as Temp[]).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    setTemp(opt);
                    setPagina(1);
                  }}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    temp === opt
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {opt === "todos"
                    ? "Todos"
                    : opt === "quente"
                      ? "Quentes"
                      : "Mornos"}
                </button>
              ))}
            </div>
            <Button
              type="button"
              variant={soSemSite ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setSoSemSite((v) => !v);
                setPagina(1);
              }}
            >
              <Globe className="size-4" />
              Sem site
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={baixarPlanilha}
              className="ml-auto"
            >
              <Download className="size-4" />
              Baixar planilha
            </Button>
          </div>

          {/* resumo */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span>
              <b className="text-foreground">{filtrados.length}</b> leads
            </span>
            <span className="inline-flex items-center gap-1 text-orange-400">
              <Flame className="size-3.5" />
              {quentes} quentes
            </span>
            <span className="inline-flex items-center gap-1">
              <Globe className="size-3.5" />
              {semSite} sem site
            </span>
          </div>

          {filtrados.length === 0 ? (
            <div className="grid place-items-center rounded-xl border border-dashed border-border py-16 text-center">
              <MapPin className="size-8 text-muted-foreground" />
              <p className="mt-3 font-medium">Nenhum lead com esse filtro</p>
            </div>
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {visiveis.map((l) => (
                  <LeadCard key={l.lugar_id || l.nome} lead={l} />
                ))}
              </div>
              <Paginacao
                pagina={paginaAtual}
                totalPaginas={totalPaginas}
                onMudar={(p) => {
                  setPagina(p);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
