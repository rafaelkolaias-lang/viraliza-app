"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Loader2, Check } from "lucide-react";
import { redefinirSenha } from "@/app/actions/senha";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/auth/password-input";
import { cn } from "@/lib/utils";

const MIN_SENHA = 8;

export function NovaSenhaForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(redefinirSenha, undefined);
  const [senha, setSenha] = useState("");
  const senhaOk = senha.length >= MIN_SENHA;

  // link sem token = acesso direto/invalido
  if (!token) {
    return (
      <Card className="w-full border-border/70 bg-card/80">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl">Link inválido</CardTitle>
          <CardDescription>
            Esse link de redefinição não é válido. Peça um novo.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button className="w-full" render={<Link href="/esqueci-senha" />}>
            Pedir novo link
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="w-full border-border/70 bg-card/80">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">Criar nova senha</CardTitle>
        <CardDescription>Escolha uma senha nova pra sua conta.</CardDescription>
      </CardHeader>
      <form action={action}>
        <CardContent className="space-y-4">
          <input type="hidden" name="token" value={token} />
          <div className="space-y-2">
            <Label htmlFor="senha">Nova senha</Label>
            <PasswordInput
              id="senha"
              name="senha"
              autoComplete="new-password"
              placeholder="Mínimo de 8 caracteres"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
            />
            <p
              className={cn(
                "flex items-center gap-1.5 text-xs transition-colors",
                senhaOk ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Check
                className={cn(
                  "size-3.5 transition-opacity",
                  senhaOk ? "opacity-100" : "opacity-40",
                )}
              />
              Pelo menos {MIN_SENHA} caracteres
            </p>
          </div>
          {state?.erro && (
            <p className="text-sm font-medium text-destructive">{state.erro}</p>
          )}
          <Button
            type="submit"
            size="lg"
            className="h-11 w-full"
            disabled={pending || !senhaOk}
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            Salvar nova senha
          </Button>
        </CardContent>
      </form>
    </Card>
  );
}
