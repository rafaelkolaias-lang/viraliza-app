"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, PanelTop, Send, Trash2, Power, Link2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  criarComunicado,
  alterarAtivoAviso,
  excluirAviso,
  excluirLoteNotificacao,
} from "@/app/actions/notificacoes";

export interface AdminUsuarioOpt {
  id: string;
  nome: string;
  email: string;
}
export interface AdminAviso {
  id: string;
  mensagem: string;
  cor: "laranja" | "vermelho" | "azul" | "verde";
  link: string | null;
  ativo: boolean;
  alvo: string | null; // nome do usuário alvo, ou null = todos
  criadoEm: string;
}
export interface AdminLote {
  loteId: string;
  titulo: string;
  total: number;
  criadoEm: string;
}

const CORES: { valor: AdminAviso["cor"]; nome: string; classe: string }[] = [
  { valor: "laranja", nome: "Laranja", classe: "bg-orange-500" },
  { valor: "vermelho", nome: "Vermelho", classe: "bg-red-600" },
  { valor: "azul", nome: "Azul", classe: "bg-blue-600" },
  { valor: "verde", nome: "Verde", classe: "bg-emerald-600" },
];

const fmtData = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function NotificacoesAdmin({
  usuarios,
  avisos,
  lotes,
}: {
  usuarios: AdminUsuarioOpt[];
  avisos: AdminAviso[];
  lotes: AdminLote[];
}) {
  return (
    <div className="space-y-8">
      <FormComunicado usuarios={usuarios} />
      <ListaBarras avisos={avisos} />
      <ListaSininho lotes={lotes} />
    </div>
  );
}

function FormComunicado({ usuarios }: { usuarios: AdminUsuarioOpt[] }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [tipo, setTipo] = useState<"sininho" | "barra">("sininho");
  const [cor, setCor] = useState<AdminAviso["cor"]>("azul");
  const [state, action, enviando] = useActionState(criarComunicado, undefined);

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      setCor("azul");
      toast.success(
        state.enviados
          ? `Enviado pra ${state.enviados} usuário(s).`
          : "Barra publicada no topo do site.",
      );
      router.refresh();
    } else if (state?.erro) {
      toast.error(state.erro);
    }
  }, [state, router]);

  return (
    <form
      ref={formRef}
      action={action}
      className="space-y-4 rounded-xl border border-border bg-card p-4"
    >
      <p className="font-medium">Novo comunicado</p>

      {/* tipo: sininho ou barra */}
      <input type="hidden" name="tipo" value={tipo} />
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setTipo("sininho")}
          className={cn(
            "flex items-center gap-2 rounded-lg border p-3 text-left text-sm transition-colors",
            tipo === "sininho"
              ? "border-primary bg-primary/10 text-foreground"
              : "border-border text-muted-foreground hover:border-primary/50",
          )}
        >
          <Bell className="size-4.5 shrink-0" />
          <span>
            <span className="block font-medium">Sininho</span>
            <span className="block text-xs text-muted-foreground">
              Aparece no sino do usuário
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => setTipo("barra")}
          className={cn(
            "flex items-center gap-2 rounded-lg border p-3 text-left text-sm transition-colors",
            tipo === "barra"
              ? "border-primary bg-primary/10 text-foreground"
              : "border-border text-muted-foreground hover:border-primary/50",
          )}
        >
          <PanelTop className="size-4.5 shrink-0" />
          <span>
            <span className="block font-medium">Barra no topo</span>
            <span className="block text-xs text-muted-foreground">
              Faixa colorida no topo do site
            </span>
          </span>
        </button>
      </div>

      {/* destino */}
      <div className="space-y-1.5">
        <Label htmlFor="destino">Para quem</Label>
        <select
          id="destino"
          name="destino"
          defaultValue="todos"
          className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <option value="todos">Todos os usuários</option>
          {usuarios.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nome} ({u.email})
            </option>
          ))}
        </select>
      </div>

      {/* título (só sininho) */}
      {tipo === "sininho" && (
        <div className="space-y-1.5">
          <Label htmlFor="titulo">Título</Label>
          <Input
            id="titulo"
            name="titulo"
            maxLength={255}
            placeholder="Ex: Novidade na plataforma"
          />
        </div>
      )}

      {/* mensagem */}
      <div className="space-y-1.5">
        <Label htmlFor="mensagem">Mensagem</Label>
        <Textarea
          id="mensagem"
          name="mensagem"
          required
          rows={tipo === "barra" ? 2 : 3}
          maxLength={2000}
          placeholder={
            tipo === "barra"
              ? "Ex: Promoção de créditos até domingo!"
              : "Escreva o aviso que vai aparecer no sininho."
          }
        />
      </div>

      {/* cor (só barra) */}
      {tipo === "barra" && (
        <div className="space-y-1.5">
          <input type="hidden" name="cor" value={cor} />
          <Label>Cor da barra</Label>
          <div className="flex flex-wrap gap-2">
            {CORES.map((c) => (
              <button
                key={c.valor}
                type="button"
                onClick={() => setCor(c.valor)}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors",
                  cor === c.valor
                    ? "border-foreground/40 bg-accent"
                    : "border-border hover:border-primary/50",
                )}
              >
                <span className={cn("size-4 rounded-full", c.classe)} />
                {c.nome}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* link (opcional, ambos) */}
      <div className="space-y-1.5">
        <Label htmlFor="link">Link (opcional)</Label>
        <Input
          id="link"
          name="link"
          maxLength={500}
          placeholder="Ex: /painel/creditos ou https://sua-promo.com"
        />
        <p className="text-xs text-muted-foreground">
          Ao clicar, leva o usuário pra esse endereço. Deixe vazio se não quiser link.
        </p>
      </div>

      <Button type="submit" disabled={enviando}>
        <Send className="size-4" />
        {enviando ? "Enviando..." : tipo === "barra" ? "Publicar barra" : "Enviar notificação"}
      </Button>
    </form>
  );
}

function ListaBarras({ avisos }: { avisos: AdminAviso[] }) {
  const router = useRouter();
  const [agindo, startAcao] = useTransition();

  function toggle(a: AdminAviso) {
    startAcao(async () => {
      const res = await alterarAtivoAviso(a.id, !a.ativo);
      if (res?.erro) return toast.error(res.erro);
      toast.success(a.ativo ? "Barra desativada." : "Barra ativada.");
      router.refresh();
    });
  }
  function remover(a: AdminAviso) {
    if (!confirm("Excluir esta barra de vez?")) return;
    startAcao(async () => {
      const res = await excluirAviso(a.id);
      if (res?.erro) return toast.error(res.erro);
      toast.success("Barra excluída.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold">Barras do topo</h2>
      {avisos.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          Nenhuma barra criada ainda.
        </p>
      ) : (
        <ul className="space-y-2">
          {avisos.map((a) => {
            const c = CORES.find((x) => x.valor === a.cor);
            return (
              <li
                key={a.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
              >
                <span className={cn("size-3 shrink-0 rounded-full", c?.classe)} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{a.mensagem}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                    <span>{a.alvo ? `Para: ${a.alvo}` : "Para: todos"}</span>
                    <span>·</span>
                    <span>{fmtData.format(new Date(a.criadoEm))}</span>
                    {a.link && (
                      <span className="inline-flex items-center gap-1">
                        · <Link2 className="size-3" /> {a.link}
                      </span>
                    )}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                    a.ativo
                      ? "bg-emerald-500/15 text-emerald-500"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {a.ativo ? "No ar" : "Desligada"}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={agindo}
                  title={a.ativo ? "Desativar" : "Ativar"}
                  onClick={() => toggle(a)}
                >
                  <Power className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={agindo}
                  title="Excluir"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => remover(a)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ListaSininho({ lotes }: { lotes: AdminLote[] }) {
  const router = useRouter();
  const [agindo, startAcao] = useTransition();

  function remover(l: AdminLote) {
    if (!confirm(`Excluir este envio de ${l.total} usuário(s)?`)) return;
    startAcao(async () => {
      const res = await excluirLoteNotificacao(l.loteId);
      if (res?.erro) return toast.error(res.erro);
      toast.success("Envio removido.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold">Envios pra todos (sininho)</h2>
      {lotes.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          Nenhum envio em massa ainda. (Envios pra 1 usuário só não aparecem aqui.)
        </p>
      ) : (
        <ul className="space-y-2">
          {lotes.map((l) => (
            <li
              key={l.loteId}
              className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
            >
              <Bell className="size-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{l.titulo}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {l.total} usuário(s) · {fmtData.format(new Date(l.criadoEm))}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                disabled={agindo}
                title="Excluir envio"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => remover(l)}
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
