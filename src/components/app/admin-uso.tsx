"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarRange, ChevronDown, ChevronUp, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  FERRAMENTAS,
  GRUPO_ROTULO,
  PERIODOS_USO,
  somarUso,
  totalUso,
  usoVazio,
  type ChaveFerramenta,
  type GrupoUso,
  type UsoFerramentas,
} from "@/lib/uso-ferramentas";

export type LinhaUso = {
  id: string;
  nome: string;
  email: string;
  role: string;
  uso: UsoFerramentas;
};

const fmt = (n: number) => Math.round(n).toLocaleString("pt-BR");
const GRUPOS: GrupoUso[] = ["imagem", "videoIa", "outro"];
type OrdemChave = "nome" | "total" | ChaveFerramenta;

export function AdminUso({
  linhas,
  dias,
  inicio,
  fim,
}: {
  linhas: LinhaUso[];
  /** período fixo em dias, ou -1 quando o admin escolheu um intervalo próprio */
  dias: number;
  /** pontas do período personalizado, no formato do input de data (AAAA-MM-DD) */
  inicio?: string;
  fim?: string;
}) {
  const router = useRouter();
  const [ordem, setOrdem] = useState<{ k: OrdemChave; desc: boolean }>({
    k: "total",
    desc: true,
  });
  const [esconderParados, setEsconderParados] = useState(true);
  const [busca, setBusca] = useState("");
  const [dataInicio, setDataInicio] = useState(inicio ?? "");
  const [dataFim, setDataFim] = useState(fim ?? "");

  const personalizado = dias === -1;

  /** Manda a página buscar de novo com o intervalo digitado. */
  function filtrarPeriodo() {
    if (!dataInicio && !dataFim) {
      toast.info("Escolha ao menos uma das datas.");
      return;
    }
    if (dataInicio && dataFim && dataInicio > dataFim) {
      toast.error("A data de início é depois da data final. Confira as duas.");
      return;
    }
    const q = new URLSearchParams();
    if (dataInicio) q.set("inicio", dataInicio);
    if (dataFim) q.set("fim", dataFim);
    router.push(`/admin/uso?${q.toString()}`);
  }

  const valor = (l: LinhaUso, k: OrdemChave) =>
    k === "nome" ? l.nome : k === "total" ? totalUso(l.uso) : l.uso[k];

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    let base = esconderParados ? linhas.filter((l) => totalUso(l.uso) > 0) : linhas;
    if (q) {
      base = base.filter(
        (l) => l.nome.toLowerCase().includes(q) || l.email.toLowerCase().includes(q),
      );
    }
    return [...base].sort((a, b) => {
      const va = valor(a, ordem.k);
      const vb = valor(b, ordem.k);
      const cmp =
        typeof va === "string" && typeof vb === "string"
          ? va.localeCompare(vb, "pt-BR")
          : (va as number) - (vb as number);
      return ordem.desc ? -cmp : cmp;
    });
  }, [linhas, ordem, esconderParados, busca]);

  const totais = useMemo(
    () => linhas.reduce((acc, l) => somarUso(acc, l.uso), usoVazio()),
    [linhas],
  );
  const totalGeral = totalUso(totais);
  const campeao = useMemo(() => {
    let melhor: ChaveFerramenta | null = null;
    for (const f of FERRAMENTAS) {
      if (totais[f.chave] > 0 && (!melhor || totais[f.chave] > totais[melhor])) melhor = f.chave;
    }
    return melhor;
  }, [totais]);

  const parados = linhas.length - linhas.filter((l) => totalUso(l.uso) > 0).length;

  function ThOrd({
    k,
    titulo,
    ajuda,
    className,
  }: {
    k: OrdemChave;
    titulo: string;
    ajuda?: string;
    className?: string;
  }) {
    const ativo = ordem.k === k;
    return (
      <TableHead
        title={ajuda}
        onClick={() => setOrdem((o) => (o.k === k ? { k, desc: !o.desc } : { k, desc: true }))}
        className={cn(
          "cursor-pointer select-none text-right hover:text-foreground",
          ativo && "text-primary",
          className,
        )}
      >
        <span className="inline-flex items-center gap-0.5">
          {titulo}
          {ativo &&
            (ordem.desc ? <ChevronDown className="size-3" /> : <ChevronUp className="size-3" />)}
        </span>
      </TableHead>
    );
  }

  return (
    <div className="space-y-3">
      {/* Período: atalhos fixos + intervalo escolhido na mão */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Período:</span>
        {PERIODOS_USO.map((p) => (
          <Link
            key={p.v}
            href={`/admin/uso?dias=${p.v}`}
            className={cn(
              "rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
              // com o intervalo próprio ligado (dias = -1) nenhum atalho acende,
              // senão pareceria que a tela está mostrando dois períodos ao mesmo tempo
              p.v === dias
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-muted",
            )}
          >
            {p.label}
          </Link>
        ))}

        <span className="mx-1 hidden h-5 w-px bg-border sm:block" />

        <div
          className={cn(
            "flex flex-wrap items-center gap-1.5 rounded-lg border px-2 py-1 transition-colors",
            personalizado ? "border-primary bg-primary/5" : "border-border",
          )}
        >
          <CalendarRange
            className={cn("size-3.5", personalizado ? "text-primary" : "text-muted-foreground")}
          />
          <input
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            aria-label="Data de início"
            className="rounded-md border border-border bg-background px-1.5 py-0.5 text-xs outline-none focus:border-primary"
          />
          <span className="text-xs text-muted-foreground">até</span>
          <input
            type="date"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
            aria-label="Data final"
            className="rounded-md border border-border bg-background px-1.5 py-0.5 text-xs outline-none focus:border-primary"
          />
          <button
            type="button"
            onClick={filtrarPeriodo}
            className="rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Filtrar
          </button>
          {personalizado && (
            <button
              type="button"
              onClick={() => {
                setDataInicio("");
                setDataFim("");
                router.push("/admin/uso");
              }}
              aria-label="Limpar o período personalizado"
              title="Voltar ao período padrão"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Busca + filtro de quem não usou nada */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full min-w-[200px] sm:w-auto sm:max-w-xs sm:flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Procurar por nome ou e-mail"
            className="h-9 pl-8 pr-8"
          />
          {busca && (
            <button
              type="button"
              onClick={() => setBusca("")}
              aria-label="Limpar busca"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={esconderParados}
            onChange={(e) => setEsconderParados(e.target.checked)}
            className="size-3.5 accent-primary"
          />
          Esconder quem não usou nada
          {parados > 0 && <span className="text-muted-foreground/70">({parados})</span>}
        </label>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <Table>
          <TableHeader>
            {/* linha 1: os 3 grupos; linha 2: ferramenta por ferramenta */}
            <TableRow className="hover:bg-transparent">
              {/* largura travada: nome quilométrico não pode empurrar as
                  colunas de número pra fora da tela (o truncate da célula só
                  funciona com esse teto) */}
              <TableHead
                rowSpan={2}
                className="max-w-[180px] truncate align-bottom sm:max-w-[240px]"
              >
                Usuário
              </TableHead>
              {GRUPOS.map((g) => (
                <TableHead
                  key={g}
                  colSpan={FERRAMENTAS.filter((f) => f.grupo === g).length}
                  className="border-l border-border/60 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  {GRUPO_ROTULO[g]}
                </TableHead>
              ))}
              <TableHead rowSpan={2} className="border-l border-border/60 text-right align-bottom">
                Total
              </TableHead>
            </TableRow>
            <TableRow className="hover:bg-transparent">
              {FERRAMENTAS.map((f, i) => (
                <ThOrd
                  key={f.chave}
                  k={f.chave}
                  titulo={f.curto}
                  ajuda={f.ajuda ? `${f.rotulo}. ${f.ajuda}` : f.rotulo}
                  className={cn(
                    "text-[11px]",
                    // separa visualmente os 3 grupos
                    (i === 0 ||
                      FERRAMENTAS[i - 1]?.grupo !== f.grupo) &&
                      "border-l border-border/60",
                  )}
                />
              ))}
            </TableRow>
          </TableHeader>

          <TableBody>
            {visiveis.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={FERRAMENTAS.length + 2}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  {busca
                    ? esconderParados
                      ? "Ninguém com esse nome ou e-mail usou algo nesse período. Desmarque \"esconder quem não usou nada\" pra ver quem não usou."
                      : "Ninguém com esse nome ou e-mail."
                    : "Ninguém usou nenhuma ferramenta nesse período."}
                </TableCell>
              </TableRow>
            ) : (
              visiveis.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="max-w-[180px] sm:max-w-[240px]">
                    {/* o title mostra o nome/e-mail inteiros no hover, já que o
                        texto cortado com "..." esconde o resto */}
                    <p className="truncate text-sm font-medium" title={l.nome}>
                      {l.nome}
                      {l.role === "admin" && (
                        <span className="ml-1.5 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                          admin
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted-foreground" title={l.email}>
                      {l.email}
                    </p>
                  </TableCell>
                  {FERRAMENTAS.map((f, i) => (
                    <TableCell
                      key={f.chave}
                      className={cn(
                        "text-right text-sm tabular-nums",
                        l.uso[f.chave] === 0 && "text-muted-foreground/30",
                        (i === 0 || FERRAMENTAS[i - 1]?.grupo !== f.grupo) &&
                          "border-l border-border/60",
                      )}
                    >
                      {fmt(l.uso[f.chave])}
                    </TableCell>
                  ))}
                  <TableCell className="border-l border-border/60 text-right text-sm font-semibold tabular-nums">
                    {fmt(totalUso(l.uso))}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>

          <TableFooter>
            <TableRow className="hover:bg-transparent">
              <TableCell className="text-xs font-medium text-muted-foreground">
                Total da plataforma
              </TableCell>
              {FERRAMENTAS.map((f, i) => (
                <TableCell
                  key={f.chave}
                  className={cn(
                    "text-right text-sm tabular-nums",
                    totais[f.chave] === 0 && "text-muted-foreground/40",
                    f.chave === campeao && "font-bold text-primary",
                    (i === 0 || FERRAMENTAS[i - 1]?.grupo !== f.grupo) &&
                      "border-l border-border/60",
                  )}
                >
                  {fmt(totais[f.chave])}
                </TableCell>
              ))}
              <TableCell className="border-l border-border/60 text-right text-sm font-semibold tabular-nums">
                {fmt(totalGeral)}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>

      <p className="text-[11px] text-muted-foreground">
        {busca && visiveis.length > 0 && (
          <>
            Mostrando {visiveis.length} de {linhas.length} pessoas. A linha de total
            continua somando a plataforma inteira.{" "}
          </>
        )}
        Clique no nome de uma coluna pra ordenar por ela. Em destaque, a ferramenta mais
        usada do período. Passe o mouse no cabeçalho pra ver o nome completo e as
        ressalvas de cada contagem. Vídeo que deu erro ou que a pessoa apagou continua
        contando: o número mede uso (e crédito gasto), não o que sobrou na conta.
      </p>
    </div>
  );
}
