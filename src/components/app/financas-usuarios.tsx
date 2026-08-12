"use client";

import { useMemo, useState } from "react";
import { ArrowUpDown, ChevronDown, ChevronUp, Search, X } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** mesma forma de `GastoUsuarioLinha` (lib/gastos-api.ts), repetida aqui porque
 *  aquele arquivo é server-only e este componente roda no navegador */
export type GastoUsuario = {
  userId: string;
  nome: string;
  email: string;
  custoCentavos: number;
  creditosCentavos: number;
  margemCentavos: number;
};

const brl = (c: number) =>
  (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** colunas que dá pra ordenar clicando no cabeçalho */
type OrdemChave = "nome" | "custoCentavos" | "creditosCentavos" | "margemCentavos";
/** null = ordem em que a lista chegou (maior custo primeiro, feita no servidor) */
type Ordem = { k: OrdemChave; desc: boolean } | null;

/** Cabeçalho clicável. Mora FORA do componente de propósito: componente
 *  declarado dentro do render é recriado a cada desenho e perde o estado. */
function ThOrd({
  k,
  titulo,
  ajuda,
  className,
  ordem,
  onOrdenar,
}: {
  k: OrdemChave;
  titulo: string;
  ajuda?: string;
  className?: string;
  ordem: Ordem;
  onOrdenar: (k: OrdemChave) => void;
}) {
  const ativo = ordem?.k === k;
  return (
    <TableHead
      title={ajuda}
      aria-sort={ativo ? (ordem.desc ? "descending" : "ascending") : "none"}
      onClick={() => onOrdenar(k)}
      className={cn(
        "cursor-pointer select-none hover:text-foreground",
        ativo && "text-primary",
        className,
      )}
    >
      <span
        className={cn("inline-flex items-center gap-0.5", k !== "nome" && "flex-row-reverse")}
      >
        {titulo}
        {ativo ? (
          ordem.desc ? (
            <ChevronDown className="size-3" />
          ) : (
            <ChevronUp className="size-3" />
          )
        ) : (
          <ArrowUpDown className="size-3 opacity-30" />
        )}
      </span>
    </TableHead>
  );
}

export function FinancasUsuarios({ linhas }: { linhas: GastoUsuario[] }) {
  const [busca, setBusca] = useState("");
  const [ordem, setOrdem] = useState<Ordem>(null);

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const base = q
      ? linhas.filter(
          (u) => u.nome.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
        )
      : linhas;
    if (!ordem) return base;
    return [...base].sort((a, b) => {
      const cmp =
        ordem.k === "nome"
          ? a.nome.localeCompare(b.nome, "pt-BR")
          : a[ordem.k] - b[ordem.k];
      return ordem.desc ? -cmp : cmp;
    });
  }, [linhas, busca, ordem]);

  /**
   * Três estados por coluna: 1º clique maior primeiro, 2º menor primeiro, 3º
   * volta pra ordem que veio do servidor (que já é por custo, maior primeiro).
   */
  function alternar(k: OrdemChave) {
    setOrdem((o) => (o?.k !== k ? { k, desc: true } : o.desc ? { k, desc: false } : null));
  }

  return (
    <div className="space-y-2">
      <div className="relative max-w-xs">
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

      <div className="overflow-hidden rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <ThOrd
                k="nome"
                titulo="Usuário"
                ajuda="Ordenar por nome"
                ordem={ordem}
                onOrdenar={alternar}
              />
              <ThOrd
                k="custoCentavos"
                titulo="Custo APIs"
                ajuda="Ordenar pelo custo de API. Um clique: quem mais gastou. Dois: quem menos gastou. Três: volta ao padrão."
                className="text-right"
                ordem={ordem}
                onOrdenar={alternar}
              />
              <ThOrd
                k="creditosCentavos"
                titulo="Créditos gastos"
                ajuda="Em reais e, entre parênteses, a quantidade de créditos (1 crédito = R$ 0,01). Clique pra ordenar."
                className="hidden text-right sm:table-cell"
                ordem={ordem}
                onOrdenar={alternar}
              />
              <ThOrd
                k="margemCentavos"
                titulo="Margem"
                ajuda="Ordenar pela margem (créditos pagos menos custo de API)"
                className="text-right"
                ordem={ordem}
                onOrdenar={alternar}
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {visiveis.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                  Ninguém com esse nome ou e-mail gastou no período.
                </TableCell>
              </TableRow>
            ) : (
              visiveis.map((u) => (
                <TableRow key={u.userId}>
                  <TableCell>
                    <p className="text-sm font-medium">{u.nome}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </TableCell>
                  <TableCell className="text-right text-sm font-semibold">
                    {brl(u.custoCentavos)}
                  </TableCell>
                  <TableCell className="hidden text-right text-sm text-muted-foreground sm:table-cell">
                    {brl(u.creditosCentavos)}{" "}
                    <span className="text-xs text-muted-foreground/70">
                      ({u.creditosCentavos.toLocaleString("pt-BR")})
                    </span>
                  </TableCell>
                  <TableCell
                    className={`text-right text-sm font-semibold ${
                      u.margemCentavos < 0 ? "text-red-500" : "text-emerald-600"
                    }`}
                  >
                    {u.margemCentavos < 0 ? "−" : "+"} {brl(Math.abs(u.margemCentavos))}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-[11px] text-muted-foreground">
        {busca && visiveis.length > 0 && (
          <>
            Mostrando {visiveis.length} de {linhas.length}.{" "}
          </>
        )}
        Clique no nome de uma coluna pra ordenar por ela: o primeiro clique põe o
        maior em cima, o segundo o menor, e o terceiro volta ao padrão (maior custo
        de API primeiro).
      </p>
    </div>
  );
}
