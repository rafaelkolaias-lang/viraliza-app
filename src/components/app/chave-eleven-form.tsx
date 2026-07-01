"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Loader2, KeyRound, Trash2, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  salvarChaveEleven,
  removerChaveEleven,
  type ContaState,
} from "@/app/actions/conta";

export function ChaveElevenForm({ configurada }: { configurada: boolean }) {
  const [salvarState, salvar, salvando] = useActionState<ContaState, FormData>(
    salvarChaveEleven,
    undefined,
  );
  const [removerState, remover, removendo] = useActionState<
    ContaState,
    FormData
  >(removerChaveEleven, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (salvarState?.ok) {
      toast.success("Chave salva! Suas vozes já aparecem no Estúdio. 🎙️");
      formRef.current?.reset();
    } else if (salvarState?.erro) {
      toast.error(salvarState.erro);
    }
  }, [salvarState]);

  useEffect(() => {
    if (removerState?.ok) toast.success("Chave removida.");
    else if (removerState?.erro) toast.error(removerState.erro);
  }, [removerState]);

  return (
    <div className="space-y-3">
      {configurada && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5">
          <p className="flex items-center gap-2 text-xs text-emerald-300">
            <CheckCircle2 className="size-4" />
            Chave configurada. A geração de voz usa a sua conta (sem gastar
            crédito).
          </p>
          <form action={remover}>
            <Button type="submit" size="sm" variant="ghost" disabled={removendo}>
              {removendo ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              Remover
            </Button>
          </form>
        </div>
      )}

      <form ref={formRef} action={salvar} className="space-y-2">
        <Input
          name="chave"
          type="password"
          autoComplete="off"
          placeholder={configurada ? "Trocar por outra chave (sk_...)" : "sk_..."}
        />
        <Button type="submit" size="sm" disabled={salvando}>
          {salvando ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <KeyRound className="size-4" />
          )}
          {configurada ? "Atualizar chave" : "Salvar chave"}
        </Button>
      </form>
    </div>
  );
}
