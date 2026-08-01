"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Menu, X, Coins, Crown, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { NavLinks } from "@/components/app/nav-links";
import { UserMenu } from "@/components/app/user-menu";
import { NotificacoesSino } from "@/components/app/notificacoes-sino";
import { AvisoBarra } from "@/components/app/aviso-barra";
import { ModalInstagramBonus } from "@/components/app/modal-instagram-bonus";
import { BannerCreditosBaixos } from "@/components/app/banner-creditos-baixos";
import type { AvisoDTO } from "@/lib/notificacoes";
import type { StatusBonusIg } from "@/lib/promos";
import { Separator } from "@/components/ui/separator";
import { FundoGrade } from "@/components/app/fundo-grade";
import { cn } from "@/lib/utils";

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
  avisos = [],
  bonusIgStatus = "nenhum",
}: {
  user: AppUser;
  children: React.ReactNode;
  saldoCentavos?: number;
  assinante?: boolean;
  /** % do crédito que ainda NÃO foi gasto (saldo / total que entrou). */
  pctNaoGasto?: number;
  /** barras coloridas ativas pro usuário (topo do site). */
  avisos?: AvisoDTO[];
  /** situação do bônus do Instagram (controla o modal de +300 créditos). */
  bonusIgStatus?: StatusBonusIg;
}) {
  const [openMenu, setOpenMenu] = useState(false);
  // Barra lateral do desktop recolhida (só ícones). Fica guardado no navegador,
  // então quem gosta de tela cheia não precisa recolher toda vez que entra.
  // Começa aberta e só recolhe depois de hidratar, pra não piscar na 1ª pintura.
  const [recolhida, setRecolhida] = useState(false);
  const isAdmin = user.role === "admin";
  const pathname = usePathname();

  useEffect(() => {
    setRecolhida(localStorage.getItem("nav_recolhida") === "1");
  }, []);

  function alternarBarra() {
    setRecolhida((atual) => {
      localStorage.setItem("nav_recolhida", atual ? "0" : "1");
      return !atual;
    });
  }

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

  // Conteúdo da navegação (reaproveitado no desktop e no drawer). No drawer do
  // celular nunca é compacto: lá o espaço é a tela inteira.
  const navInterno = (compacto = false) => (
    <>
      <div className={compacto ? "flex-1 overflow-y-auto px-2" : "flex-1 overflow-y-auto px-3"}>
        <NavLinks onNavigate={() => setOpenMenu(false)} isAdmin={isAdmin} compacto={compacto} />
      </div>
      <Separator />
      <div className={compacto ? "space-y-2 p-2" : "space-y-2 p-3"}>
        {/* Saldo de crédito + status da assinatura - acima do nome */}
        <Link
          href="/painel/creditos"
          onClick={() => setOpenMenu(false)}
          title={compacto ? `${fmtCreditos(saldoCentavos)} créditos` : undefined}
          className={cn(
            "block rounded-xl border border-border bg-card/60 transition-colors hover:border-primary/50",
            compacto ? "p-2 text-center" : "p-3",
          )}
        >
          {compacto ? (
            <span className="flex flex-col items-center gap-1">
              <span className="grid size-8 place-items-center rounded-lg bg-primary/15 text-primary">
                <Coins className="size-4" />
              </span>
              <span className="text-[11px] font-bold leading-none">
                {fmtCreditos(saldoCentavos)}
              </span>
            </span>
          ) : (
          <>
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
          </>
          )}
        </Link>
        <UserMenu nome={user.nome} email={user.email} compacto={compacto} />
      </div>
    </>
  );

  return (
    <div className="min-h-dvh">
      {/* Promoções (só pra usuário comum): modal do Instagram + banner de crédito baixo */}
      {!isAdmin && (
        <>
          <ModalInstagramBonus status={bonusIgStatus} />
          <BannerCreditosBaixos saldoCentavos={saldoCentavos} />
        </>
      )}

      {/* Sidebar fixa (desktop), com o botão de recolher na borda */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-border bg-sidebar transition-[width] duration-300 ease-out md:flex",
          recolhida ? "w-[76px]" : "w-64",
        )}
      >
        <div
          className={cn(
            "flex items-center gap-2 p-5",
            recolhida ? "flex-col justify-center px-2 py-4" : "justify-between",
          )}
        >
          <BrandMark size={recolhida ? 30 : 34} />
          <NotificacoesSino />
        </div>
        {navInterno(recolhida)}

        {/* pastilha na borda: recolhe e abre a barra */}
        <button
          type="button"
          onClick={alternarBarra}
          aria-label={recolhida ? "Expandir menu" : "Recolher menu"}
          aria-expanded={!recolhida}
          title={recolhida ? "Expandir menu" : "Recolher menu"}
          className="absolute -right-3.5 top-24 grid size-7 place-items-center rounded-full border border-border bg-background text-muted-foreground shadow-lg transition-all hover:border-primary/60 hover:text-primary hover:shadow-[0_0_16px_-2px_var(--color-primary)]"
        >
          {recolhida ? (
            <PanelLeftOpen className="size-3.5" />
          ) : (
            <PanelLeftClose className="size-3.5" />
          )}
        </button>
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
        {navInterno()}
      </aside>

      {/* Conteúdo - fundo opaco + isolate + min-h evitam o "fantasma" de composição
          (no Android a tela anterior vazava numa faixa ao navegar). */}
      <main
        className={cn(
          "relative isolate min-h-dvh bg-background transition-[padding] duration-300 ease-out",
          recolhida ? "md:pl-[76px]" : "md:pl-64",
        )}
      >
        {/* grade quadriculada com o brilho verde: a cara do app inteiro */}
        <FundoGrade />
        <AvisoBarra avisos={avisos} />
        <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
