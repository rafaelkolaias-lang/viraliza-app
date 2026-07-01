"use client";

import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Coins, Plus, Minus, X, BookOpen, Wrench, Check, Ban } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ajustarCreditoAdmin,
  alterarBiblioteca,
  alterarFerramentas,
} from "@/app/actions/usuarios";
import { cn } from "@/lib/utils";
import type { LinhaUsuario } from "@/lib/admin";

const fmt = (n: number) => Math.round(n).toLocaleString("pt-BR");
const ATALHOS = [1000, 2000, 5000, 10000];

function vistoLabel(iso: string | null, online: boolean) {
  if (online) return "agora";
  if (!iso) return "nunca entrou";
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 1) return "agora há pouco";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return `há ${d} dia${d > 1 ? "s" : ""}`;
}

export function AdminUsuarios({ usuarios }: { usuarios: LinhaUsuario[] }) {
  const router = useRouter();
  const [aberto, setAberto] = useState<string | null>(null);
  const [valor, setValor] = useState("");
  const [salvando, startSalvar] = useTransition();

  function aplicar(userId: string, creditos: number) {
    if (!creditos) return toast.error("Informe um valor.");
    startSalvar(async () => {
      const res = await ajustarCreditoAdmin(userId, creditos);
      if (res?.erro) {
        toast.error(res.erro);
        return;
      }
      toast.success(
        creditos > 0
          ? `+${fmt(creditos)} créditos adicionados.`
          : `${fmt(creditos)} créditos removidos.`,
      );
      setValor("");
      router.refresh();
    });
  }

  function toggleBiblioteca(u: LinhaUsuario) {
    startSalvar(async () => {
      const res = await alterarBiblioteca(u.id, !u.assinante);
      if (res?.erro) {
        toast.error(res.erro);
        return;
      }
      toast.success(u.assinante ? "Biblioteca bloqueada." : "Biblioteca liberada.");
      router.refresh();
    });
  }

  function toggleFerramentas(u: LinhaUsuario) {
    startSalvar(async () => {
      const res = await alterarFerramentas(u.id, !u.ferramentasLiberadas);
      if (res?.erro) {
        toast.error(res.erro);
        return;
      }
      toast.success(
        u.ferramentasLiberadas ? "Ferramentas bloqueadas." : "Ferramentas liberadas.",
      );
      router.refresh();
    });
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Usuário</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden text-right sm:table-cell">Gerados</TableHead>
            <TableHead className="text-right">Gasto</TableHead>
            <TableHead className="text-right">Saldo</TableHead>
            <TableHead className="text-right">Crédito</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {usuarios.map((u) => {
            const editando = aberto === u.id;
            return (
              <Fragment key={u.id}>
                <TableRow>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "size-2 shrink-0 rounded-full",
                          u.online
                            ? "bg-emerald-500 shadow-[0_0_0_3px] shadow-emerald-500/20"
                            : "bg-muted-foreground/40",
                        )}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {u.nome}
                          {u.role === "admin" && (
                            <span className="ml-1.5 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                              admin
                            </span>
                          )}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "text-xs font-medium",
                        u.online ? "text-emerald-500" : "text-muted-foreground",
                      )}
                    >
                      {vistoLabel(u.vistoEm, u.online)}
                    </span>
                    {(!u.assinante || !u.ferramentasLiberadas) && u.role === "user" && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {!u.assinante && (
                          <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-600">
                            sem biblioteca
                          </span>
                        )}
                        {!u.ferramentasLiberadas && (
                          <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] font-medium text-red-600">
                            sem ferramentas
                          </span>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="hidden text-right text-sm text-muted-foreground sm:table-cell">
                    {fmt(u.jobs)}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    <span className={u.gastoCentavos > 0 ? "font-medium" : "text-muted-foreground"}>
                      {fmt(u.gastoCentavos)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-sm font-semibold">
                    {fmt(u.saldoCentavos)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant={editando ? "secondary" : "outline"}
                      size="sm"
                      className="h-8"
                      onClick={() => {
                        setAberto(editando ? null : u.id);
                        setValor("");
                      }}
                    >
                      {editando ? <X className="size-4" /> : <Coins className="size-4" />}
                      {editando ? "Fechar" : "Gerenciar"}
                    </Button>
                  </TableCell>
                </TableRow>

                {editando && (
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableCell colSpan={6} className="py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground">
                          Adicionar rápido:
                        </span>
                        {ATALHOS.map((a) => (
                          <Button
                            key={a}
                            variant="outline"
                            size="sm"
                            className="h-8"
                            disabled={salvando}
                            onClick={() => aplicar(u.id, a)}
                          >
                            +{fmt(a)}
                          </Button>
                        ))}
                        <span className="mx-1 h-6 w-px bg-border" />
                        <Input
                          type="number"
                          inputMode="numeric"
                          placeholder="créditos"
                          value={valor}
                          onChange={(e) => setValor(e.target.value)}
                          className="h-8 w-32"
                          disabled={salvando}
                        />
                        <Button
                          size="sm"
                          className="h-8"
                          disabled={salvando}
                          onClick={() => aplicar(u.id, Math.abs(Number(valor) || 0))}
                        >
                          <Plus className="size-4" />
                          Adicionar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-destructive hover:text-destructive"
                          disabled={salvando}
                          onClick={() => aplicar(u.id, -Math.abs(Number(valor) || 0))}
                        >
                          <Minus className="size-4" />
                          Remover
                        </Button>
                        <span className="ml-auto text-xs text-muted-foreground">
                          Saldo atual: <b className="text-foreground">{fmt(u.saldoCentavos)}</b> créditos
                        </span>
                      </div>

                      {/* Controle de acesso: biblioteca (acervos) + ferramentas */}
                      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
                        <span className="text-xs font-medium text-muted-foreground">
                          Acesso:
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          className={cn(
                            "h-8",
                            u.assinante
                              ? "text-red-600 hover:text-red-600"
                              : "text-emerald-600 hover:text-emerald-600",
                          )}
                          disabled={salvando}
                          onClick={() => toggleBiblioteca(u)}
                          title="Acervos, virais, produtos e área do membro"
                        >
                          <BookOpen className="size-4" />
                          {u.assinante ? "Tirar biblioteca" : "Liberar biblioteca"}
                          {u.assinante ? (
                            <Ban className="size-3.5 opacity-70" />
                          ) : (
                            <Check className="size-3.5 opacity-70" />
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className={cn(
                            "h-8",
                            u.ferramentasLiberadas
                              ? "text-red-600 hover:text-red-600"
                              : "text-emerald-600 hover:text-emerald-600",
                          )}
                          disabled={salvando}
                          onClick={() => toggleFerramentas(u)}
                          title="Editor automático, cortes, em lote e leads"
                        >
                          <Wrench className="size-4" />
                          {u.ferramentasLiberadas ? "Tirar ferramentas" : "Liberar ferramentas"}
                          {u.ferramentasLiberadas ? (
                            <Ban className="size-3.5 opacity-70" />
                          ) : (
                            <Check className="size-3.5 opacity-70" />
                          )}
                        </Button>
                        <span className="ml-auto text-[11px] text-muted-foreground">
                          Biblioteca: <b className={u.assinante ? "text-emerald-600" : "text-red-600"}>{u.assinante ? "liberada" : "bloqueada"}</b>
                          {" · "}
                          Ferramentas: <b className={u.ferramentasLiberadas ? "text-emerald-600" : "text-red-600"}>{u.ferramentasLiberadas ? "liberadas" : "bloqueadas"}</b>
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
