"use client";

import Link from "next/link";
import { LogOut, User as UserIcon, Receipt } from "lucide-react";
import { sair } from "@/app/actions/auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

function iniciais(nome: string) {
  return nome
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

export function UserMenu({
  nome,
  email,
  compacto = false,
}: {
  nome: string;
  email: string;
  /** barra lateral recolhida: mostra só a bolinha com as iniciais */
  compacto?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        title={compacto ? nome : undefined}
        className={cn(
          "flex w-full items-center rounded-lg p-2 text-left transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none",
          compacto ? "justify-center" : "gap-3",
        )}
      >
        <Avatar className="size-9 border border-border">
          <AvatarFallback className="bg-primary/15 text-sm font-semibold text-primary">
            {iniciais(nome)}
          </AvatarFallback>
        </Avatar>
        {!compacto && (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{nome}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {email}
            </span>
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {/* GroupLabel do base-ui precisa estar dentro de um Group (senão estoura) */}
        <DropdownMenuGroup>
          <DropdownMenuLabel>Minha conta</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/painel/conta" />}>
          <UserIcon className="size-4" />
          Conta
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/painel/extrato" />}>
          <Receipt className="size-4" />
          Extrato da conta
        </DropdownMenuItem>
        {/* Sair via form action: o redirect do server action roda de forma confiável
            (o onClick do item fechava o menu e cancelava a ação antes de deslogar). */}
        <form action={sair} className="contents">
          <DropdownMenuItem
            variant="destructive"
            closeOnClick={false}
            nativeButton
            render={<button type="submit" />}
          >
            <LogOut className="size-4" />
            Sair
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
