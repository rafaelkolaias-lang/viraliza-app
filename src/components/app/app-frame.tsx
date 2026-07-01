"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Menu, X, Coins, Crown } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { NavLinks } from "@/components/app/nav-links";
import { UserMenu } from "@/components/app/user-menu";
import { NotificacoesSino } from "@/components/app/notificacoes-sino";
import { AvisoBarra } from "@/components/app/aviso-barra";
import type { AvisoDTO } from "@/lib/notificacoes";
import { Separator } from "@/components/ui/separator";

interface AppUser {
  nome: string;
  email: string;
  role?: "admin" | "user";
}

// 1 crédito = R$ 0,01, então o saldo em centavos é o próprio nº de créditos.
function fmtCreditos(centavos: number) {
  return centavos.toLocaleString("pt-BR");
}

export function AppFrame({
  user,
  children,
  saldoCentavos = 0,
  assinante = false,
  pctNaoGasto = 0,
  viraisTimestamps = [],
  avisos = [],
}: {
  user: AppUser;
  children: React.ReactNode;
  saldoCentavos?: number;
  assinante?: boolean;
  /** % do crédito que ainda NÃO foi gasto (saldo / total que entrou). */
  pctNaoGasto?: number;
  viraisTimestamps?: string[];
  /** barras coloridas ativas pro usuário (topo do site). */
  avisos?: AvisoDTO[];
}) {
  const [openMenu, setOpenMenu] = useState(false);
  const isAdmin = user.role === "admin";
  const pathname = usePathname();

  // Fecha o drawer ao trocar de página.
  useEffect(() => {
    setOpenMenu(false);
  }, [pathname]);

  // Trava o scroll do fundo + fecha no ESC enquanto o drawer está aberto.
  useEffect(() => {
    if (!openMenu) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenMenu(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [openMenu]);

  // Conteúdo da navegação (reaproveitado no desktop e no drawer).
  const navInterno = (
    <>
      <div className="flex-1 overflow-y-auto px-3">
        <NavLinks
          onNavigate={() => setOpenMenu(false)}
          isAdmin={isAdmin}
          viraisTimestamps={viraisTimestamps}
        />
      </div>
      <Separator />
      <div className="space-y-2 p-3">
        {/* Saldo de crédito + status da assinatura - acima do nome */}
        <Link
          href="/painel/creditos"
          onClick={() => setOpenMenu(false)}
          className="block rounded-xl border border-border bg-card/60 p-3 transition-colors hover:border-primary/50"
        >
          <div className="flex items-center gap-2">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
              <Coins className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Créditos de IA
              </p>
              <p className="text-sm font-bold leading-none text-foreground">
                {fmtCreditos(saldoCentavos)}
              </p>
            </div>
            {assinante && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-400">
                <Crown className="size-3" />
                Assinante
              </span>
            )}
          </div>
          {/* barra: quanto do crédito ainda não foi gasto */}
          <div className="mt-2.5">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${Math.max(0, Math.min(100, pctNaoGasto))}%` }}
              />
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">
              {Math.max(0, Math.min(100, pctNaoGasto))}% disponível
            </p>
          </div>
        </Link>
        <UserMenu nome={user.nome} email={user.email} />
      </div>
    </>
  );

  return (
    <div className="min-h-dvh">
      {/* Sidebar fixa (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-sidebar md:flex">
        <div className="flex items-center justify-between p-5">
          <BrandMark size={34} />
          <NotificacoesSino />
        </div>
        {navInterno}
      </aside>

      {/* Top bar (mobile) */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background px-4 md:hidden">
        <button
          type="button"
          onClick={() => setOpenMenu(true)}
          aria-label="Abrir menu"
          aria-expanded={openMenu}
          className="-ml-1 grid size-10 place-items-center rounded-lg text-foreground transition-colors hover:bg-muted active:bg-muted"
        >
          <Menu className="size-6" />
        </button>
        <BrandMark size={30} />
        <div className="ml-auto">
          <NotificacoesSino />
        </div>
      </header>

      {/* Drawer (mobile) - overlay + painel próprio, sem dependência externa.
          O overlay só é montado quando aberto: assim, fechado, NADA fica no
          z-40 cobrindo a tela e engolindo o toque do botão de abrir no iOS.
          `cursor-pointer` é obrigatório p/ o iOS disparar onClick em <div>. */}
      {openMenu && (
        <div
          onClick={() => setOpenMenu(false)}
          aria-hidden
          className="fixed inset-0 z-40 cursor-pointer bg-black/60 backdrop-blur-sm md:hidden"
        />
      )}
      {/* Painel deslizante - fechado fica fora da tela E inerte (pointer-events-none). */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[82%] max-w-xs flex-col border-r border-border bg-sidebar shadow-2xl transition-transform duration-200 ease-out md:hidden ${
          openMenu ? "translate-x-0" : "pointer-events-none -translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between p-5">
          <BrandMark size={32} />
          <button
            type="button"
            onClick={() => setOpenMenu(false)}
            aria-label="Fechar menu"
            className="grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>
        {navInterno}
      </aside>

      {/* Conteúdo - fundo opaco + isolate + min-h evitam o "fantasma" de composição
          (no Android a tela anterior vazava numa faixa ao navegar). */}
      <main className="relative isolate min-h-dvh bg-background md:pl-64">
        <AvisoBarra avisos={avisos} />
        <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
