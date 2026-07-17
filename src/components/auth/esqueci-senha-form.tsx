"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Loader2, MailCheck } from "lucide-react";
import { solicitarReset } from "@/app/actions/senha";
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

export function EsqueciSenhaForm() {
  const [state, action, pending] = useActionState(solicitarReset, undefined);

  return (
    <Card className="w-full border-border/70 bg-card/80">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">Esqueci minha senha</CardTitle>
        <CardDescription>
          Digite seu e-mail e enviamos um link pra criar uma nova senha.
        </CardDescription>
      </CardHeader>

      {state?.ok ? (
        <CardContent>
          <div className="flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/10 p-4">
            <MailCheck className="mt-0.5 size-5 shrink-0 text-primary" />
            <p className="text-sm text-foreground">{state.ok}</p>
          </div>
        </CardContent>
      ) : (
        <form action={action}>
          <CardContent className="space-y-4">
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
            {state?.erro && (
              <p className="text-sm font-medium text-destructive">{state.erro}</p>
            )}
            <Button type="submit" size="lg" className="h-11 w-full" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Enviar link de redefinição
            </Button>
          </CardContent>
        </form>
      )}

      <CardFooter>
        <p className="w-full text-center text-sm text-muted-foreground">
          Lembrou a senha?{" "}
          <Link
            href="/login"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Voltar pro login
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
