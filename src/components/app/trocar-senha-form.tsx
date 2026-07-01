"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Loader2, KeyRound } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { trocarSenha, type ContaState } from "@/app/actions/conta";

export function TrocarSenhaForm() {
  const [state, action, pending] = useActionState<ContaState, FormData>(
    trocarSenha,
    undefined,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) {
      toast.success("Senha alterada com sucesso! 🔒");
      formRef.current?.reset();
    } else if (state?.erro) {
      toast.error(state.erro);
    }
  }, [state]);

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="atual">Senha atual</Label>
        <Input id="atual" name="atual" type="password" autoComplete="current-password" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="nova">Nova senha</Label>
        <Input
          id="nova"
          name="nova"
          type="password"
          autoComplete="new-password"
          placeholder="Pelo menos 6 caracteres"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmar">Confirmar nova senha</Label>
        <Input
          id="confirmar"
          name="confirmar"
          type="password"
          autoComplete="new-password"
          placeholder="Repita a nova senha"
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
        Trocar senha
      </Button>
    </form>
  );
}
