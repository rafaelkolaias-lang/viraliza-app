"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Bell,
  Camera,
  ChevronDown,
  Clapperboard,
  Coins,
  Compass,
  Crown,
  DollarSign,
  Film,
  Flag,
  Flame,
  FlaskConical,
  Gauge,
  Gift,
  GraduationCap,
  Newspaper,
  Home,
  Image as ImageIcon,
  Images,
  LayoutGrid,
  LifeBuoy,
  MapPin,
  MessageCircle,
  MessageSquarePlus,
  Music2,
  Palette,
  PenLine,
  Pickaxe,
  ShoppingBag,
  Sparkles,
  Stamp,
  Trash2,
  UserRound,
  Users,
  Video,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: typeof Home;
  novidade?: boolean; // mostra o foguinho de novidade
};

/**
 * Foguinho das novidades: substituiu a etiqueta "Novo". A chama tem duas camadas
 * (o brilho pulsando atrás e a chama tremulando na frente), então ele "queima" de
 * verdade em vez de só piscar. Puro CSS, sem imagem e sem biblioteca.
 */
function Foguinho() {
  return (
    <span className="relative ml-auto grid size-6 place-items-center" aria-label="Novidade">
      <span className="absolute inset-0 animate-ping rounded-full bg-orange-500/25" />
      <span className="absolute inset-1 rounded-full bg-orange-500/25 blur-[6px]" />
      <Flame
        className="relative size-4 fill-amber-400 text-orange-500 drop-shadow-[0_0_6px_rgba(249,115,22,0.9)] [animation:tremula_1.1s_ease-in-out_infinite]"
        strokeWidth={1.5}
      />
      <style>{`@keyframes tremula {
        0%, 100% { transform: scale(1) rotate(-2deg); }
        35% { transform: scale(1.14) rotate(3deg); }
        70% { transform: scale(0.96) rotate(-1deg); }
      }`}</style>
    </span>
  );
}

// Itens do topo (antes dos grupos retráteis)
const navTopo: NavItem[] = [
  { href: "/painel/inicio", label: "Início", icon: Home },
  { href: "/painel", label: "Meus vídeos", icon: LayoutGrid },
  { href: "/painel/shopee", label: "Shopee", icon: ShoppingBag },
  { href: "/painel/tiktok", label: "Produtos TikTok", icon: Music2, novidade: true },
  { href: "/painel/acervo", label: "Acervo de cortes", icon: Film },
];

// Itens depois do grupo Ferramentas
const navFim: NavItem[] = [
  // Viral Boost fica AQUI, e não no topo: ele é uma ferramenta de geração, então
  // o lugar dele é depois dos grupos, colado no Academy (pedido do dono).
  { href: "/painel/viral-boost", label: "Viral Boost", icon: Flame, novidade: true },
  { href: "/painel/academy", label: "Viraliza Academy", icon: GraduationCap },
  { href: "/painel/assinatura", label: "Assinatura", icon: Crown },
  { href: "/painel/creditos", label: "Créditos", icon: Coins },
  { href: "/painel/ajuda", label: "Ajuda", icon: LifeBuoy },
  { href: "/painel/indique", label: "Indique e Ganhe", icon: Gift },
  { href: "/painel/sugestoes", label: "Sugestões", icon: MessageSquarePlus },
  { href: "/painel/blog", label: "Blog", icon: Newspaper },
];

/**
 * Grupos retráteis do menu.
 *
 * `exato` existe porque a raiz do grupo também é um sub-item: sem ele, estar em
 * "/painel/meus-avatares/criar" acenderia "Galeria de avatares" junto, já que a
 * comparação normal é por começo do endereço.
 */
type SubItem = { href: string; label: string; icon: typeof Home; exato?: boolean };

type Grupo = {
  chave: string; // chave no localStorage (lembra aberto/fechado)
  /** tela do grupo: acende o grupo quando a pessoa está nela e é pra onde o
   *  ícone leva com a barra recolhida (aí os sub-itens não cabem na tela) */
  raiz: string;
  label: string;
  icon: typeof Home;
  itens: readonly SubItem[];
};

const GRUPOS: readonly Grupo[] = [
  {
    chave: "nav_personalize_aberto",
    raiz: "/painel/meus-avatares",
    label: "Personalize com IA",
    icon: Palette,
    itens: [
      { href: "/painel/meus-avatares/criar", label: "Criar com IA", icon: Sparkles },
      {
        href: "/painel/meus-avatares",
        label: "Galeria de avatares",
        icon: UserRound,
        exato: true,
      },
      { href: "/painel/meus-avatares/cenarios", label: "Meus cenários", icon: ImageIcon },
    ],
  },
  {
    chave: "nav_lab_aberto",
    raiz: "/painel/lab",
    label: "Viraliza Labs",
    icon: FlaskConical,
    itens: [
      { href: "/painel/lab", label: "Criar criativo", icon: Compass, exato: true },
      { href: "/painel/lab/livre", label: "Vídeo livre", icon: Video },
      { href: "/painel/lab/imagens", label: "Minhas imagens", icon: Images },
      { href: "/painel/lab/prompt", label: "Gerador de prompt", icon: PenLine },
    ],
  },
  {
    chave: "nav_ferramentas_aberto",
    // era `/painel/ferramentas` (uma grade de cards que repetia estes atalhos).
    // A tela foi apagada: com o submenu aqui, ela virou um clique a mais pro
    // mesmo lugar. A raiz agora é a 1ª ferramenta, usada só na barra recolhida.
    raiz: "/painel/novo",
    label: "Ferramentas",
    icon: Wrench,
    itens: [
      { href: "/painel/novo", label: "Editor automático", icon: Sparkles },
      { href: "/painel/lote", label: "Aplicar marca em lote", icon: Stamp },
      { href: "/painel/leads", label: "MapsLeads", icon: MapPin },
      { href: "/painel/cortes", label: "Cortes de qualquer vídeo", icon: Clapperboard },
      { href: "/painel/minerador", label: "Minerador", icon: Pickaxe },
    ],
  },
];

export const adminItems = [
  { href: "/admin", label: "Visão geral", icon: Gauge },
  { href: "/admin/financas", label: "Finanças", icon: DollarSign },
  { href: "/admin/videos", label: "Vídeos", icon: Clapperboard },
  { href: "/admin/imagens", label: "Imagens", icon: ImageIcon },
  { href: "/admin/usuarios", label: "Usuários", icon: Users },
  { href: "/admin/bonus", label: "Bônus IG", icon: Camera },
  { href: "/admin/indicacoes", label: "Indicações", icon: Gift },
  { href: "/admin/avatares", label: "Avatares", icon: UserRound },
  { href: "/admin/chat", label: "Chat", icon: MessageCircle },
  { href: "/admin/reportes", label: "Reportes de vídeo", icon: Flag },
  { href: "/admin/excluidos", label: "Excluídos", icon: Trash2 },
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

/** Avisa o React quando algum grupo abre/fecha (esta aba ou outra). */
function subscribeGrupos(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("nav-grupo", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("nav-grupo", callback);
  };
}

/**
 * Aberto/fechado de um grupo, lido do localStorage como estado externo (padrão
 * = aberto). Vai por `useSyncExternalStore` pra não cair no lint de
 * setState-em-effect nem piscar entre servidor e navegador.
 */
function useGrupoAberto(chave: string) {
  const aberto = useSyncExternalStore(
    subscribeGrupos,
    () => localStorage.getItem(chave) !== "0",
    () => true,
  );
  function alternar() {
    localStorage.setItem(chave, aberto ? "0" : "1");
    window.dispatchEvent(new Event("nav-grupo"));
  }
  return { aberto, alternar };
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
  novidade = false,
  onNavigate,
  sub = false,
  compacto = false,
}: {
  href: string;
  label: string;
  Icon: typeof Home;
  active: boolean;
  badge?: number;
  novidade?: boolean;
  onNavigate?: () => void;
  sub?: boolean;
  /** barra recolhida: só o ícone, com o nome num balãozinho no hover */
  compacto?: boolean;
}) {
  if (compacto) {
    return (
      <Link
        href={href}
        onClick={onNavigate}
        title={label}
        aria-label={label}
        className={cn(
          "group relative grid h-11 place-items-center rounded-lg transition-colors",
          active
            ? "bg-primary/12 text-primary"
            : "text-muted-foreground hover:bg-accent hover:text-foreground",
        )}
      >
        <Icon className="size-5" />
        {badge > 0 ? (
          <span className="absolute right-1.5 top-1.5 grid size-4 place-items-center rounded-full bg-orange-500 text-[9px] font-bold text-white">
            {badge > 9 ? "9+" : badge}
          </span>
        ) : novidade ? (
          <span className="absolute right-1 top-1">
            <Flame
              className="size-3.5 fill-amber-400 text-orange-500 drop-shadow-[0_0_5px_rgba(249,115,22,0.9)] [animation:tremula_1.1s_ease-in-out_infinite]"
              strokeWidth={1.5}
            />
          </span>
        ) : null}
        {/* nome do item aparece ao lado quando passa o mouse */}
        <span className="pointer-events-none absolute left-full z-50 ml-2 hidden whitespace-nowrap rounded-lg border border-border bg-popover px-2.5 py-1.5 text-xs font-medium shadow-xl group-hover:block">
          {label}
        </span>
      </Link>
    );
  }

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
      {badge > 0 ? (
        <span
          className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-orange-500 px-1.5 text-[11px] font-bold text-white shadow-sm"
          aria-label={`${badge} novo(s)`}
        >
          {badge > 9 ? "9+" : badge}
        </span>
      ) : novidade ? (
        <Foguinho />
      ) : null}
    </Link>
  );
}

/**
 * Um grupo retrátil. A setinha recolhe/expande os atalhos; o nome só abre e
 * fecha também, EXCETO nos grupos `navegavel`, onde ele leva pra uma tela que
 * não está entre os atalhos. Com a barra recolhida sobra só o ícone, que leva
 * pra tela do grupo (os sub-itens não cabem numa coluna de ícones).
 */
function GrupoRetratil({
  grupo,
  isActive,
  onNavigate,
  compacto,
}: {
  grupo: Grupo;
  isActive: (href: string, exato?: boolean) => boolean;
  onNavigate?: () => void;
  compacto: boolean;
}) {
  const { aberto, alternar } = useGrupoAberto(grupo.chave);

  // o grupo acende quando a pessoa está em QUALQUER tela dele, senão com a
  // lista recolhida ela não teria pista de onde está
  const ativo =
    isActive(grupo.raiz) || grupo.itens.some((i) => isActive(i.href, i.exato));

  if (compacto) {
    return (
      <Item
        href={grupo.raiz}
        label={grupo.label}
        Icon={grupo.icon}
        active={ativo}
        onNavigate={onNavigate}
        compacto
      />
    );
  }

  const classeNome = cn(
    "flex flex-1 items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors",
    ativo
      ? "bg-primary/12 text-primary"
      : "text-muted-foreground hover:bg-accent hover:text-foreground",
  );

  return (
    <>
      <div className="flex items-center gap-1">
        {/* o nome NÃO navega: só abre e fecha. A tela de cada grupo já é um dos
            atalhos logo abaixo, então levar pra algum lugar aqui seria repetir */}
        <button type="button" onClick={alternar} aria-expanded={aberto} className={classeNome}>
          <grupo.icon className="size-4.5" />
          {grupo.label}
        </button>
        <button
          type="button"
          onClick={alternar}
          aria-label={aberto ? `Recolher ${grupo.label}` : `Expandir ${grupo.label}`}
          aria-expanded={aberto}
          className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <ChevronDown className={cn("size-4 transition-transform", !aberto && "-rotate-90")} />
        </button>
      </div>
      {aberto && (
        <div className="mb-1 ml-3 flex flex-col gap-1 border-l border-border pl-2">
          {grupo.itens.map(({ href, label, icon: Icon, exato }) => (
            <Item
              key={href}
              href={href}
              label={label}
              Icon={Icon}
              active={isActive(href, exato)}
              onNavigate={onNavigate}
              sub
            />
          ))}
        </div>
      )}
    </>
  );
}

export function NavLinks({
  onNavigate,
  isAdmin = false,
  compacto = false,
}: {
  onNavigate?: () => void;
  isAdmin?: boolean;
  /** barra lateral recolhida (desktop): a navegação vira uma coluna de ícones */
  compacto?: boolean;
}) {
  const pathname = usePathname();
  const isActive = (href: string, exato = false) =>
    exato || href === "/painel" || href === "/admin"
      ? pathname === href
      : pathname.startsWith(href);

  const hidratado = useHidratado();

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
        {navTopo.map(({ href, label, icon: Icon, novidade }) => (
          <Item
            key={href}
            href={href}
            label={label}
            Icon={Icon}
            active={isActive(href)}
            badge={badgeDe(href)}
            novidade={novidade}
            onNavigate={onNavigate}
            compacto={compacto}
          />
        ))}

        {/* Personalize com IA, Viraliza Labs e Ferramentas: a setinha (e o nome,
            fora do Ferramentas) recolhe/expande os atalhos do grupo. */}
        {GRUPOS.map((grupo) => (
          <GrupoRetratil
            key={grupo.chave}
            grupo={grupo}
            isActive={isActive}
            onNavigate={onNavigate}
            compacto={compacto}
          />
        ))}

        {navFim.map(({ href, label, icon: Icon, novidade }) => (
          <Item
            key={href}
            href={href}
            label={label}
            Icon={Icon}
            active={isActive(href)}
            badge={badgeDe(href)}
            novidade={novidade}
            onNavigate={onNavigate}
            compacto={compacto}
          />
        ))}
      </nav>

      {isAdmin && (
        <div className="flex flex-col gap-1">
          {compacto ? (
            <span className="mx-auto mb-1 h-px w-8 bg-border" />
          ) : (
            <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
              Admin
            </p>
          )}
          {adminItems.map(({ href, label, icon: Icon }) => (
            <Item
              key={href}
              href={href}
              label={label}
              Icon={Icon}
              active={isActive(href)}
              onNavigate={onNavigate}
              compacto={compacto}
            />
          ))}
        </div>
      )}
    </div>
  );
}
