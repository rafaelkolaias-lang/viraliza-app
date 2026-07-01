"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Loader2, Check } from "lucide-react";
import { cadastrar } from "@/app/actions/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/auth/password-input";
import { cn } from "@/lib/utils";

const MIN_SENHA = 6;

export function SignupForm() {
  const [state, action, pending] = useActionState(cadastrar, undefined);
  const [senha, setSenha] = useState("");
  const senhaOk = senha.length >= MIN_SENHA;

  return (
    <Card className="w-full border-border/70 bg-card/80">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">Criar conta</CardTitle>
        <CardDescription>
          Comece a gerar seus vídeos em minutos. É grátis.
        </CardDescription>
      </CardHeader>
      <form action={action}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome</Label>
            <Input
              id="nome"
              name="nome"
              autoComplete="name"
              placeholder="Como podemos te chamar?"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="voce@email.com"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="senha">Senha</Label>
            <PasswordInput
              id="senha"
              name="senha"
              autoComplete="new-password"
              placeholder="Mínimo de 6 caracteres"
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
        </CardContent>
        <CardFooter className="mt-2 flex flex-col gap-4">
          <Button type="submit" size="lg" className="h-11 w-full" disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            Criar conta
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Já tem conta?{" "}
            <Link
              href="/login"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Entrar
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
