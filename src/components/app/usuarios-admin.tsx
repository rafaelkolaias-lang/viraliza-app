"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Trash2, Ban, Unlock, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  criarUsuario,
  excluirUsuario,
  alterarPapel,
  alterarBloqueio,
  resetarDemo,
} from "@/app/actions/usuarios";

export type Papel = "admin" | "user" | "demo";

export interface AdminUsuario {
  id: string;
  nome: string;
  email: string;
  role: Papel;
  bloqueado: boolean;
  videos: number;
  criadoEm: string;
}

const PAPEL_LABEL: Record<Papel, string> = {
  admin: "Admin",
  user: "Usuário",
  demo: "Demo",
};

const PAPEL_CLASSE: Record<Papel, string> = {
  admin: "bg-primary/15 text-primary",
  user: "bg-muted text-muted-foreground",
  demo: "bg-amber-500/15 text-amber-500",
};

const fmtData = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function iniciais(nome: string) {
  return (
    nome
      .split(" ")
      .slice(0, 2)
      .map((p) => p[0])
      .join("")
      .toUpperCase() || "?"
  );
}

export function UsuariosAdmin({
  usuarios,
  currentUserId,
}: {
  usuarios: AdminUsuario[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [agindo, startAcao] = useTransition();

  function excluir(u: AdminUsuario) {
    if (
      !confirm(
        `Excluir "${u.nome}"?\nIsso apaga a conta e TODOS os vídeos dele. Não dá pra desfazer.`,
      )
    )
      return;
    startAcao(async () => {
      const res = await excluirUsuario(u.id);
      if (res?.erro) {
        toast.error(res.erro);
        return;
      }
      toast.success("Usuário excluído.");
      router.refresh();
    });
  }

  function bloquear(u: AdminUsuario) {
    const txt = u.bloqueado
      ? `Liberar o acesso de "${u.nome}"? Ele vai poder logar de novo.`
      : `Bloquear "${u.nome}"?\nQuem estiver logado nessa conta cai na hora e NÃO consegue logar até você liberar.`;
    if (!confirm(txt)) return;
    startAcao(async () => {
      const res = await alterarBloqueio(u.id, !u.bloqueado);
      if (res?.erro) {
        toast.error(res.erro);
        return;
      }
      toast.success(u.bloqueado ? "Acesso liberado." : "Conta bloqueada e sessão derrubada.");
      router.refresh();
    });
  }

  function resetar(u: AdminUsuario) {
    if (
      !confirm(
        `Resetar a demo "${u.nome}"?\nApaga TODOS os vídeos/cortes que ela gerou (volta ao estado de demonstração). O usuário continua.`,
      )
    )
      return;
    startAcao(async () => {
      const res = await resetarDemo(u.id);
      if (res?.erro) {
        toast.error(res.erro);
        return;
      }
      toast.success(
        `Demo resetada - ${res?.contagem ?? 0} vídeo(s) apagado(s).`,
      );
      router.refresh();
    });
  }

  function mudarPapel(u: AdminUsuario, novo: Papel) {
    if (novo === u.role) return;
    if (
      novo === "admin" &&
      !confirm(`Tornar "${u.nome}" ADMIN? Ele poderá gerenciar tudo.`)
    )
      return;
    startAcao(async () => {
      const res = await alterarPapel(u.id, novo);
      if (res?.erro) {
        toast.error(res.erro);
        router.refresh(); // volta o select pro valor real
        return;
      }
      toast.success(`Papel alterado para ${PAPEL_LABEL[novo]}.`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <FormNovo />

      <div className="rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuário</TableHead>
              <TableHead>Papel</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Vídeos</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Desde</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usuarios.map((u) => {
              const souEu = u.id === currentUserId;
              return (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="size-8 border border-border">
                        <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">
                          {iniciais(u.nome)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {u.nome}
                          {souEu && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              (você)
                            </span>
                          )}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {u.email}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {souEu ? (
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                          PAPEL_CLASSE[u.role],
                        )}
                      >
                        {PAPEL_LABEL[u.role]}
                      </span>
                    ) : (
                      <select
                        value={u.role}
                        disabled={agindo}
                        onChange={(e) => mudarPapel(u, e.target.value as Papel)}
                        className="h-8 rounded-md border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                      >
                        <option value="user">Usuário</option>
                        <option value="admin">Admin</option>
                        <option value="demo">Demo</option>
                      </select>
                    )}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                        u.bloqueado
                          ? "bg-destructive/15 text-destructive"
                          : "bg-primary/15 text-primary",
                      )}
                    >
                      {u.bloqueado ? "Bloqueado" : "Ativo"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-medium">{u.videos}</TableCell>
                  <TableCell className="hidden text-right text-muted-foreground sm:table-cell">
                    {fmtData.format(new Date(u.criadoEm))}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      {u.role === "demo" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={agindo}
                          title="Resetar demo (apaga os vídeos gerados)"
                          className="text-primary hover:bg-primary/10 hover:text-primary"
                          onClick={() => resetar(u)}
                        >
                          <RotateCcw className="size-4" />
                          Resetar
                        </Button>
                      )}
                      <Button
                        variant={u.bloqueado ? "outline" : "ghost"}
                        size="sm"
                        disabled={agindo || souEu}
                        title={
                          souEu
                            ? "Você não pode bloquear a si mesmo"
                            : u.bloqueado
                              ? "Liberar acesso"
                              : "Bloquear (derruba a sessão)"
                        }
                        className={
                          u.bloqueado
                            ? "text-primary"
                            : "text-amber-500 hover:bg-amber-500/10 hover:text-amber-500"
                        }
                        onClick={() => bloquear(u)}
                      >
                        {u.bloqueado ? (
                          <>
                            <Unlock className="size-4" />
                            Liberar
                          </>
                        ) : (
                          <Ban className="size-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={agindo || souEu}
                        title={souEu ? "Você não pode se excluir" : "Excluir"}
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => excluir(u)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function FormNovo() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [aberto, setAberto] = useState(false);
  const [state, action, enviando] = useActionState(criarUsuario, undefined);

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      toast.success("Usuário cadastrado! Pode cadastrar outro ou fechar.");
      router.refresh();
    }
  }, [state, router]);

  if (!aberto) {
    return (
      <Button variant="outline" onClick={() => setAberto(true)}>
        <UserPlus className="size-4" />
        Cadastrar usuário
      </Button>
    );
  }

  return (
    <form
      ref={formRef}
      action={action}
      className="space-y-4 rounded-xl border border-border bg-card p-4"
    >
      <div className="flex items-center justify-between">
        <p className="font-medium">Novo usuário</p>
        <Button type="button" variant="ghost" size="sm" onClick={() => setAberto(false)}>
          Fechar
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="nome">Nome</Label>
          <Input id="nome" name="nome" placeholder="Maria Silva" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" name="email" type="email" placeholder="maria@email.com" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="senha">Senha</Label>
          <Input
            id="senha"
            name="senha"
            type="text"
            placeholder="mínimo 6 caracteres"
            required
          />
          <p className="text-xs text-muted-foreground">
            Passe essa senha pro usuário - ele pode trocar depois.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="role">Papel</Label>
          <select
            id="role"
            name="role"
            defaultValue="user"
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <option value="user">Usuário</option>
            <option value="admin">Admin</option>
            <option value="demo">Demo (vê tudo, mas não gera vídeo)</option>
          </select>
        </div>
      </div>

      {state?.erro && <p className="text-sm text-destructive">{state.erro}</p>}

      <Button type="submit" disabled={enviando}>
        <UserPlus className="size-4" />
        {enviando ? "Cadastrando..." : "Cadastrar"}
      </Button>
    </form>
  );
}
