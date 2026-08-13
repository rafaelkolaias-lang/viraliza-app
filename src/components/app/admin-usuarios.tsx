"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Coins, Plus, Minus, X, BookOpen, Wrench, Check, Ban, Images } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
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
  alterarNivelAdmin,
  alterarSuspeita,
} from "@/app/actions/usuarios";
import { cn } from "@/lib/utils";
import {
  FERRAMENTAS,
  GRUPO_ROTULO,
  somaGrupo,
  somarUso,
  usoVazio,
  type GrupoUso,
} from "@/lib/uso-ferramentas";
import type { LinhaUsuario } from "@/lib/admin";

const fmt = (n: number) => Math.round(n).toLocaleString("pt-BR");
const ATALHOS = [1000, 2000, 5000, 10000];
const GRUPOS: GrupoUso[] = ["imagem", "videoIa", "outro"];

/** número que some quando é zero (deixa a tabela limpa pra achar quem usa) */
function Num({ v, forte }: { v: number; forte?: boolean }) {
  return (
    <span
      className={cn(
        "tabular-nums",
        v === 0 && "text-muted-foreground/40",
        v > 0 && forte && "font-medium text-foreground",
      )}
    >
      {fmt(v)}
    </span>
  );
}

const NIVEL_INFO: Record<string, { rotulo: string; emoji: string }> = {
  bronze: { rotulo: "Bronze", emoji: "🥉" },
  prata: { rotulo: "Prata", emoji: "🥈" },
  ouro: { rotulo: "Ouro", emoji: "🥇" },
};

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

  // rodapé: soma de todo mundo + quais ferramentas a galera mais usa
  const totais = useMemo(() => {
    const uso = usuarios.reduce((acc, u) => somarUso(acc, u.uso), usoVazio());
    const ranking = FERRAMENTAS.map((f) => ({ rotulo: f.rotulo, n: uso[f.chave] }))
      .filter((r) => r.n > 0)
      .sort((a, b) => b.n - a.n)
      .slice(0, 5);
    return {
      imagens: somaGrupo(uso, "imagem"),
      videoIa: somaGrupo(uso, "videoIa"),
      outros: somaGrupo(uso, "outro"),
      gasto: usuarios.reduce((s, u) => s + u.gastoCentavos, 0),
      saldo: usuarios.reduce((s, u) => s + u.saldoCentavos, 0),
      ranking,
    };
  }, [usuarios]);

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

  function mudarNivel(u: LinhaUsuario, nivel: "bronze" | "prata" | "ouro" | "auto") {
    startSalvar(async () => {
      const res = await alterarNivelAdmin(u.id, nivel);
      if (res?.erro) {
        toast.error(res.erro);
        return;
      }
      toast.success(
        nivel === "auto"
          ? "Nível devolvido pro automático."
          : `Nível fixado em ${NIVEL_INFO[nivel].rotulo}.`,
      );
      router.refresh();
    });
  }

  function toggleSuspeita(u: LinhaUsuario) {
    startSalvar(async () => {
      const res = await alterarSuspeita(u.id, !u.suspeita);
      if (res?.erro) {
        toast.error(res.erro);
        return;
      }
      toast.success(
        u.suspeita
          ? "Marcação de suspeita removida."
          : "Conta marcada como suspeita (bronze travado).",
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
            <TableHead
              className="hidden text-right sm:table-cell"
              title="Imagens geradas no Novo influenciador, no Viraliza Labs e no Viral Boost"
            >
              Imagens
            </TableHead>
            <TableHead
              className="hidden text-right sm:table-cell"
              title="Vídeos feitos por IA: Novo influenciador, Viraliza Labs e Viral Boost"
            >
              Vídeos IA
            </TableHead>
            <TableHead
              className="hidden text-right lg:table-cell"
              title="Editor automático PRO, marca em lote, cortes, influenciador, MapsLeads e gerador de prompt"
            >
              Outros
            </TableHead>
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
                    <div className="mt-1 flex flex-wrap gap-1">
                      {u.role === "user" && (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {NIVEL_INFO[u.nivel]?.emoji ?? "🥉"} {NIVEL_INFO[u.nivel]?.rotulo ?? "Bronze"}
                          {u.nivelManual && " (fixado)"}
                        </span>
                      )}
                      {u.suspeita && (
                        <span className="rounded bg-orange-500/15 px-1.5 py-0.5 text-[10px] font-medium text-orange-600">
                          suspeita
                        </span>
                      )}
                      {u.dividaCentavos > 0 && (
                        <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] font-medium text-red-600">
                          deve {fmt(u.dividaCentavos)}
                        </span>
                      )}
                      {u.role === "user" && !u.assinante && (
                        <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-600">
                          sem biblioteca
                        </span>
                      )}
                      {u.role === "user" && !u.ferramentasLiberadas && (
                        <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] font-medium text-red-600">
                          sem ferramentas
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-right text-sm sm:table-cell">
                    <Num v={somaGrupo(u.uso, "imagem")} forte />
                  </TableCell>
                  <TableCell className="hidden text-right text-sm sm:table-cell">
                    <Num v={somaGrupo(u.uso, "videoIa")} forte />
                  </TableCell>
                  <TableCell className="hidden text-right text-sm lg:table-cell">
                    <Num v={somaGrupo(u.uso, "outro")} />
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
                    <TableCell colSpan={8} className="py-4">
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
                          title="Editor automático PRO, cortes, em lote e leads"
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

                      {/* Nível da conta: fixar na mão, devolver pro automático, suspeita */}
                      {u.role === "user" && (
                        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
                          <span className="text-xs font-medium text-muted-foreground">
                            Nível:
                          </span>
                          {(["bronze", "prata", "ouro"] as const).map((n) => (
                            <Button
                              key={n}
                              variant={u.nivel === n && u.nivelManual ? "secondary" : "outline"}
                              size="sm"
                              className="h-8"
                              disabled={salvando || u.suspeita}
                              onClick={() => mudarNivel(u, n)}
                              title={`Fixa a conta no nível ${NIVEL_INFO[n].rotulo} (o automático para de mexer)`}
                            >
                              {NIVEL_INFO[n].emoji} {NIVEL_INFO[n].rotulo}
                            </Button>
                          ))}
                          {u.nivelManual && !u.suspeita && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8"
                              disabled={salvando}
                              onClick={() => mudarNivel(u, "auto")}
                              title="Solta a trava manual: o nível volta a subir/descer sozinho"
                            >
                              Voltar pro automático
                            </Button>
                          )}
                          <span className="mx-1 h-6 w-px bg-border" />
                          <Button
                            variant="outline"
                            size="sm"
                            className={cn(
                              "h-8",
                              u.suspeita
                                ? "text-emerald-600 hover:text-emerald-600"
                                : "text-orange-600 hover:text-orange-600",
                            )}
                            disabled={salvando}
                            onClick={() => toggleSuspeita(u)}
                            title="Suspeita = cai pra Bronze e trava lá até desmarcar"
                          >
                            {u.suspeita ? "Tirar suspeita" : "Marcar suspeita"}
                          </Button>
                          <span className="ml-auto text-[11px] text-muted-foreground">
                            Atual: <b className="text-foreground">{NIVEL_INFO[u.nivel]?.rotulo ?? "Bronze"}</b>
                            {u.nivelManual ? " (fixado na mão)" : " (automático)"}
                            {u.dividaCentavos > 0 && (
                              <>
                                {" · "}
                                Dívida: <b className="text-red-600">{fmt(u.dividaCentavos)}</b>
                              </>
                            )}
                          </span>
                        </div>
                      )}

                      {/* O que essa pessoa fez, ferramenta por ferramenta */}
                      <div className="mt-3 border-t border-border/60 pt-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-medium text-muted-foreground">
                            O que já usou (desde que entrou):
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            className="ml-auto h-8"
                            render={<Link href={`/admin/criacoes?u=${u.id}`} />}
                          >
                            <Images className="size-4" />
                            Ver criações
                          </Button>
                        </div>
                        <div className="mt-2 grid gap-x-6 gap-y-3 sm:grid-cols-3">
                          {GRUPOS.map((g) => (
                            <div key={g}>
                              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                {GRUPO_ROTULO[g]}
                              </p>
                              {FERRAMENTAS.filter((f) => f.grupo === g).map((f) => (
                                <div
                                  key={f.chave}
                                  title={f.ajuda}
                                  className="flex items-baseline justify-between gap-2 border-b border-dashed border-border/40 py-1 last:border-0"
                                >
                                  <span
                                    className={cn(
                                      "text-xs",
                                      u.uso[f.chave] === 0 && "text-muted-foreground/60",
                                    )}
                                  >
                                    {f.rotulo}
                                  </span>
                                  <Num v={u.uso[f.chave]} forte />
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
        <TableFooter>
          <TableRow className="hover:bg-transparent">
            <TableCell className="text-xs font-medium text-muted-foreground">
              Total ({usuarios.length} {usuarios.length === 1 ? "usuário" : "usuários"})
            </TableCell>
            <TableCell />
            <TableCell className="hidden text-right text-sm sm:table-cell">
              <Num v={totais.imagens} forte />
            </TableCell>
            <TableCell className="hidden text-right text-sm sm:table-cell">
              <Num v={totais.videoIa} forte />
            </TableCell>
            <TableCell className="hidden text-right text-sm lg:table-cell">
              <Num v={totais.outros} />
            </TableCell>
            <TableCell className="text-right text-sm">
              <Num v={totais.gasto} forte />
            </TableCell>
            <TableCell className="text-right text-sm">
              <Num v={totais.saldo} forte />
            </TableCell>
            <TableCell />
          </TableRow>
        </TableFooter>
      </Table>

      {totais.ranking.length > 0 && (
        <p className="border-t border-border bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
          <b className="text-foreground">Mais usadas:</b>{" "}
          {totais.ranking.map((r, i) => (
            <span key={r.rotulo}>
              {i > 0 && " · "}
              {r.rotulo} ({fmt(r.n)})
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
