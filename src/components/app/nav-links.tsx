"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  LayoutGrid,
  Film,
  ShoppingBag,
  Wrench,
  Gem,
  Coins,
  Gauge,
  Users,
  Activity,
  Sparkles,
  Stamp,
  MapPin,
  Clapperboard,
  Bell,
  DollarSign,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Itens do topo (antes do grupo Ferramentas)
const navTopo = [
  { href: "/painel/inicio", label: "Início", icon: Home },
  { href: "/painel", label: "Meus vídeos", icon: LayoutGrid },
  { href: "/painel/shopee", label: "Shopee", icon: ShoppingBag },
  { href: "/painel/acervo", label: "Acervo de cortes", icon: Film },
] as const;

// Itens depois do grupo Ferramentas
const navFim = [
  { href: "/painel/membro", label: "Membro", icon: Gem },
  { href: "/painel/creditos", label: "Créditos", icon: Coins },
] as const;

// Sub-itens do grupo "Ferramentas" (expansível)
const ferramentasSub = [
  { href: "/painel/novo", label: "Editor automático", icon: Sparkles },
  { href: "/painel/lote", label: "Aplicar marca em lote", icon: Stamp },
  { href: "/painel/leads", label: "MapsLeads", icon: MapPin },
  { href: "/painel/cortes", label: "Cortes de qualquer vídeo", icon: Clapperboard },
] as const;

export const adminItems = [
  { href: "/admin", label: "Visão geral", icon: Gauge },
  { href: "/admin/financas", label: "Finanças", icon: DollarSign },
  { href: "/admin/usuarios", label: "Usuários", icon: Users },
  { href: "/admin/notificacoes", label: "Notificações", icon: Bell },
  { href: "/admin/diagnostico", label: "Diagnóstico", icon: Activity },
] as const;

/** Avisa o React quando a "última visita" muda (outra aba ou esta mesma). */
function subscribeVisto(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("virais-visto", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("virais-visto", callback);
  };
}

/** Avisa o React quando o "Ferramentas aberto/fechado" muda (esta aba ou outra). */
function subscribeFerramentas(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("nav-ferramentas", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("nav-ferramentas", callback);
  };
}

/** false no servidor e na 1ª pintura; true depois de hidratar (evita piscar a bolinha). */
function useHidratado() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

function Item({
  href,
  label,
  Icon,
  active,
  badge = 0,
  onNavigate,
  sub = false,
}: {
  href: string;
  label: string;
  Icon: typeof Home;
  active: boolean;
  badge?: number;
  onNavigate?: () => void;
  sub?: boolean;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 transition-colors",
        sub ? "py-2 text-[13px]" : "py-2.5 text-sm font-medium",
        active
          ? "bg-primary/12 text-primary"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      <Icon className={sub ? "size-4" : "size-4.5"} />
      {label}
      {badge > 0 && (
        <span
          className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-orange-500 px-1.5 text-[11px] font-bold text-white shadow-sm"
          aria-label={`${badge} novo(s)`}
        >
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </Link>
  );
}

export function NavLinks({
  onNavigate,
  isAdmin = false,
}: {
  onNavigate?: () => void;
  isAdmin?: boolean;
}) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/painel" || href === "/admin"
      ? pathname === href
      : pathname.startsWith(href);

  const hidratado = useHidratado();

  // "Ferramentas" retrátil: estado lido do localStorage (padrão = aberto). Segue o
  // mesmo padrão do "virais_visto" pra não cair no lint de setState-em-effect.
  const ferramentasAberto = useSyncExternalStore(
    subscribeFerramentas,
    () => localStorage.getItem("nav_ferramentas_aberto") !== "0",
    () => true,
  );
  function toggleFerramentas() {
    const abertoAgora = localStorage.getItem("nav_ferramentas_aberto") !== "0";
    localStorage.setItem("nav_ferramentas_aberto", abertoAgora ? "0" : "1");
    window.dispatchEvent(new Event("nav-ferramentas"));
  }

  // "última visita" guardada no navegador (lida como estado externo).
  const visto = useSyncExternalStore(
    subscribeVisto,
    () => localStorage.getItem("virais_visto") ?? "",
    () => "",
  );

  // conta os vídeos novos desde a última visita (count leve no servidor, não baixa
  // as datas). Re-consulta quando a "última visita" muda (após visitar a página).
  const [novos, setNovos] = useState(0);
  useEffect(() => {
    if (!visto) {
      setNovos(0);
      return;
    }
    let cancelado = false;
    async function carregar() {
      try {
        const r = await fetch(
          `/api/virais/timestamps?desde=${encodeURIComponent(visto)}`,
          { cache: "no-store" },
        );
        if (!r.ok) return;
        const data = (await r.json()) as { novos?: number };
        if (!cancelado && typeof data.novos === "number") setNovos(data.novos);
      } catch {
        /* sem rede - tenta de novo no próximo ciclo */
      }
    }
    carregar();
    const id = setInterval(carregar, 20000);
    return () => {
      cancelado = true;
      clearInterval(id);
    };
  }, [visto]);

  const novosVirais = hidratado ? novos : 0;
  const badgeDe = (href: string) =>
    href === "/painel/virais" ? novosVirais : 0;

  // ao entrar na página de virais, marca "visto = agora" (zera o badge)
  useEffect(() => {
    if (pathname.startsWith("/painel/virais")) {
      localStorage.setItem("virais_visto", new Date().toISOString());
      window.dispatchEvent(new Event("virais-visto"));
    }
  }, [pathname]);

  return (
    <div className="flex flex-col gap-6">
      <nav className="flex flex-col gap-1">
        {navTopo.map(({ href, label, icon: Icon }) => (
          <Item
            key={href}
            href={href}
            label={label}
            Icon={Icon}
            active={isActive(href)}
            badge={badgeDe(href)}
            onNavigate={onNavigate}
          />
        ))}

        {/* Ferramentas: o nome abre a grade; a setinha recolhe/expande os atalhos */}
        <div className="flex items-center gap-1">
          <Link
            href="/painel/ferramentas"
            onClick={onNavigate}
            className={cn(
              "flex flex-1 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              isActive("/painel/ferramentas")
                ? "bg-primary/12 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <Wrench className="size-4.5" />
            Ferramentas
          </Link>
          <button
            type="button"
            onClick={toggleFerramentas}
            aria-label={ferramentasAberto ? "Recolher ferramentas" : "Expandir ferramentas"}
            aria-expanded={ferramentasAberto}
            className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ChevronDown
              className={cn(
                "size-4 transition-transform",
                !ferramentasAberto && "-rotate-90",
              )}
            />
          </button>
        </div>
        {ferramentasAberto && (
          <div className="mb-1 ml-3 flex flex-col gap-1 border-l border-border pl-2">
            {ferramentasSub.map(({ href, label, icon: Icon }) => (
              <Item
                key={href}
                href={href}
                label={label}
                Icon={Icon}
                active={isActive(href)}
                onNavigate={onNavigate}
                sub
              />
            ))}
          </div>
        )}

        {navFim.map(({ href, label, icon: Icon }) => (
          <Item
            key={href}
            href={href}
            label={label}
            Icon={Icon}
            active={isActive(href)}
            badge={badgeDe(href)}
            onNavigate={onNavigate}
          />
        ))}
      </nav>

      {isAdmin && (
        <div className="flex flex-col gap-1">
          <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
            Admin
          </p>
          {adminItems.map(({ href, label, icon: Icon }) => (
            <Item
              key={href}
              href={href}
              label={label}
              Icon={Icon}
              active={isActive(href)}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </div>
  );
}
