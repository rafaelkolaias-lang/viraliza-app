"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, FolderDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MaterialCard } from "@/components/app/material-card";
import { adicionarMaterial, excluirMaterial } from "@/app/actions/materiais";
import type { Material } from "@/lib/types";

export function MateriaisLista({
  materiais,
  isAdmin = false,
}: {
  materiais: Material[];
  isAdmin?: boolean;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, enviando] = useActionState(adicionarMaterial, undefined);
  const [excluindo, startExcluir] = useTransition();

  // depois de adicionar com sucesso: limpa o form, avisa e atualiza a lista
  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      toast.success("Material adicionado!");
      router.refresh();
    }
  }, [state, router]);

  function excluir(m: Material) {
    if (!confirm(`Excluir "${m.titulo}"?`)) return;
    startExcluir(async () => {
      const res = await excluirMaterial(m.id);
      if (res?.erro) {
        toast.error(res.erro);
        return;
      }
      toast.success("Material excluído.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      {isAdmin && <FormAdmin action={action} state={state} enviando={enviando} formRef={formRef} />}

      {materiais.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <FolderDown className="mx-auto size-7 text-muted-foreground" />
          <p className="mt-3 font-medium">Nenhum material por aqui ainda</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {isAdmin
              ? "Adicione o primeiro pacote ali em cima."
              : "Logo o admin disponibiliza os pacotes pra você baixar."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {materiais.map((m) => (
            <MaterialCard
              key={m.id}
              material={m}
              isAdmin={isAdmin}
              onExcluir={() => excluir(m)}
              excluindo={excluindo}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FormAdmin({
  action,
  state,
  enviando,
  formRef,
}: {
  action: (formData: FormData) => void;
  state: { erro?: string } | undefined;
  enviando: boolean;
  formRef: React.RefObject<HTMLFormElement | null>;
}) {
  const [aberto, setAberto] = useState(false);

  if (!aberto) {
    return (
      <Button variant="outline" onClick={() => setAberto(true)}>
        <Plus className="size-4" />
        Adicionar material
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
        <p className="font-medium">Novo material</p>
        <Button type="button" variant="ghost" size="sm" onClick={() => setAberto(false)}>
          Fechar
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="titulo">Nome</Label>
          <Input id="titulo" name="titulo" placeholder="Pacote de mídias - Junho" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tipo">Tipo</Label>
          <select
            id="tipo"
            name="tipo"
            defaultValue="pacote"
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <option value="pacote">Pacote (tudo junto)</option>
            <option value="video">Vídeos</option>
            <option value="musica">Músicas</option>
            <option value="imagem">Imagens</option>
            <option value="outro">Outro</option>
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="url">Link ou caminho</Label>
        <Input
          id="url"
          name="url"
          placeholder="https://drive.google.com/...  ou  /downloads/pacote.zip"
          required
        />
        <p className="text-xs text-muted-foreground">
          Cole um link externo (Drive, Mega...) ou jogue o arquivo em{" "}
          <span className="font-medium">app/public/downloads/</span> e use{" "}
          <span className="font-medium">/downloads/arquivo.zip</span>.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="tamanho">Tamanho (opcional)</Label>
          <Input id="tamanho" name="tamanho" placeholder="1.2 GB" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="descricao">Descrição (opcional)</Label>
        <Textarea
          id="descricao"
          name="descricao"
          rows={2}
          placeholder="O que tem nesse material..."
        />
      </div>

      {state?.erro && <p className="text-sm text-destructive">{state.erro}</p>}

      <Button type="submit" disabled={enviando}>
        <Plus className="size-4" />
        {enviando ? "Adicionando..." : "Adicionar"}
      </Button>
    </form>
  );
}
