"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";

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

export function FinancasUsuarios({ linhas }: { linhas: GastoUsuario[] }) {
  const [busca, setBusca] = useState("");

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return linhas;
    return linhas.filter(
      (u) => u.nome.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
    );
  }, [linhas, busca]);

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
              <TableHead>Usuário</TableHead>
              <TableHead className="text-right">Custo APIs</TableHead>
              <TableHead
                className="hidden text-right sm:table-cell"
                title="Em reais e, entre parênteses, a quantidade de créditos (1 crédito = R$ 0,01)"
              >
                Créditos gastos
              </TableHead>
              <TableHead className="text-right">Margem</TableHead>
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

      {busca && visiveis.length > 0 && (
        <p className="text-[11px] text-muted-foreground">
          Mostrando {visiveis.length} de {linhas.length}.
        </p>
      )}
    </div>
  );
}
