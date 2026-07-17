"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { entrar } from "@/app/actions/auth";
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
import { GoogleButton, DivisoriaOu } from "@/components/auth/google-button";

export function LoginForm({
  googleAtivo = false,
  resetAtivo = false,
  avisoErro,
  avisoOk,
}: {
  googleAtivo?: boolean;
  resetAtivo?: boolean;
  avisoErro?: string;
  avisoOk?: string;
}) {
  const [state, action, pending] = useActionState(entrar, undefined);

  return (
    <Card className="w-full border-border/70 bg-card/80">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">Entrar</CardTitle>
        <CardDescription>Bem-vindo de volta. Acesse sua conta.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* avisos vindos da URL (ex.: erro do Google, senha redefinida) */}
        {avisoOk && (
          <p className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm font-medium text-primary">
            {avisoOk}
          </p>
        )}
        {avisoErro && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
            {avisoErro}
          </p>
        )}

        {googleAtivo && (
          <>
            <GoogleButton />
            <DivisoriaOu />
          </>
        )}

        <form action={action} className="space-y-4">
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
            <div className="flex items-center justify-between">
              <Label htmlFor="senha">Senha</Label>
              {resetAtivo && (
                <Link
                  href="/esqueci-senha"
                  className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
                >
                  Esqueci minha senha
                </Link>
              )}
            </div>
            <PasswordInput
              id="senha"
              name="senha"
              autoComplete="current-password"
              placeholder="••••••••"
              required
            />
          </div>
          {state?.erro && (
            <p className="text-sm font-medium text-destructive">{state.erro}</p>
          )}
          <Button type="submit" size="lg" className="h-11 w-full" disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            Entrar
          </Button>
        </form>
      </CardContent>
      <CardFooter>
        <p className="w-full text-center text-sm text-muted-foreground">
          Não tem conta?{" "}
          <Link
            href="/cadastro"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Criar conta
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
