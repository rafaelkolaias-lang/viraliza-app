"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
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
  Scale,
  Scissors,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Stamp,
  Trash2,
  Undo2,
  UserRound,
  Users,
  SlidersHorizontal,
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
  /** o nome do grupo LEVA pra tela dele em vez de só abrir/fechar a listinha
   *  (a setinha ao lado continua abrindo e fechando). Ligado no Viraliza Labs,
   *  que é a porta de entrada do laboratório e tem a barrinha de ferramentas. */
  navegavel?: boolean;
  itens: readonly SubItem[];
};

const GRUPOS: readonly Grupo[] = [
  {
    chave: "nav_personalize_aberto",
    // a raiz é a tela de APRESENTAÇÃO, não o "Novo influenciador": clicar no nome
    // do grupo abre a explicação das 3 telas, igual no Viraliza Labs. As três
    // continuam a um clique nos `itens` logo abaixo e na barrinha do rodapé.
    raiz: "/painel/meus-avatares/inicio",
    label: "Personalize com IA",
    icon: Palette,
    navegavel: true,
    itens: [
      // era "Criar com IA": não dizia criar O QUÊ, e "com IA" não separa nada
      // (o app inteiro é com IA). O nome do botão que gera de verdade, no fim do
      // quiz, continua sendo "Criar influenciador" - são coisas diferentes.
      { href: "/painel/meus-avatares/criar", label: "Novo influenciador", icon: Sparkles },
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
    // a raiz é a tela de APRESENTAÇÃO, não o funil: clicar no nome do grupo abre
    // a explicação das 4 ferramentas. O funil segue em `/painel/lab` (é onde o
    // login cai e pra onde a galeria manda a imagem), e continua a um clique
    // pelo "Criar criativo" logo abaixo e pela barrinha do rodapé.
    raiz: "/painel/lab/inicio",
    label: "Viraliza Labs",
    icon: FlaskConical,
    navegavel: true,
    itens: [
      { href: "/painel/lab", label: "Criar criativo", icon: Compass, exato: true },
      { href: "/painel/lab/livre", label: "Vídeo livre", icon: Video },
      { href: "/painel/lab/imagens", label: "Minhas imagens", icon: Images },
      { href: "/painel/lab/prompt", label: "Gerador de prompt", icon: PenLine },
    ],
  },
  {
    chave: "nav_ferramentas_aberto",
    // a raiz voltou a ser `/painel/ferramentas` em 06/08/2026, mas a TELA é outra:
    // a antiga era uma grade de atalhos repetidos (e foi apagada por isso, em
    // 05/08/2026); a nova EXPLICA o que cada ferramenta faz, que é o que faltava.
    // Quem já sabe o caminho continua indo direto pelos `itens` ou pela barrinha.
    raiz: "/painel/ferramentas",
    label: "Ferramentas",
    icon: Wrench,
    navegavel: true,
    itens: [
      // Dois editores, de propósito (12/08/2026): o BASIC é a tela única antiga
      // (`/painel/editor-basico`, `editor-basico.tsx`) e o PRO é o funil de 5
      // etapas (`/painel/novo`, `editor-estudio.tsx`). Mesmo backend, telas
      // diferentes. O BASIC vem primeiro por decisão do dono: é a porta de
      // entrada mais simples, e quem quer o passo a passo desce um item.
      // A barrinha do rodapé (`ferramentas-barra.tsx`) segue ESTA ordem.
      {
        href: "/painel/editor-basico",
        label: "Editor automático BASIC",
        icon: SlidersHorizontal,
      },
      { href: "/painel/novo", label: "Editor automático PRO", icon: Sparkles },
      // "Criar um Corte" é o vídeo QUE JÁ ESTÁ no computador da pessoa: corta
      // silêncio e tira pedaços, sem IA e sem copy. Não confundir com "Cortes de
      // qualquer vídeo" logo abaixo, que baixa de um LINK e fatia em vários.
      { href: "/painel/criar-corte", label: "Criar um Corte", icon: Scissors },
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
  { href: "/admin/uso", label: "Uso das ferramentas", icon: BarChart3 },
  // Vídeos, Imagens e Avatares viraram UMA tela (mesma pergunta, três lugares).
  // As antigas continuam de pé em /admin/videos, /admin/imagens e /admin/avatares,
  // só saíram do menu pra ele não crescer.
  { href: "/admin/criacoes", label: "Criação dos usuários", icon: Sparkles },
  { href: "/admin/diagnostico", label: "Diagnóstico", icon: Activity },
  { href: "/admin/usuarios", label: "Usuários", icon: Users },
  { href: "/admin/notificacoes", label: "Notificações", icon: Bell },
  { href: "/admin/bonus", label: "Bônus IG", icon: Camera },
  { href: "/admin/indicacoes", label: "Indicações", icon: Gift },
  { href: "/admin/chat", label: "Chat", icon: MessageCircle },
  { href: "/admin/reportes", label: "Reportes de vídeo", icon: Flag },
  { href: "/admin/excluidos", label: "Excluídos", icon: Trash2 },
] as const;

/**
 * Documentos legais, no fim da barra do admin e em vermelho.
 *
 * Não são tela de admin: são as páginas PÚBLICAS que o usuário final lê. Ficam
 * aqui só pra o dono conferir rápido como estão, sem ter que digitar o endereço.
 * O vermelho é pra não confundir com ferramenta de administração.
 */
export const docsLegaisItems = [
  { href: "/termos", label: "Termos de Uso", icon: Scale },
  { href: "/privacidade", label: "Privacidade", icon: ShieldCheck },
  { href: "/reembolso", label: "Reembolso", icon: Undo2 },
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
  perigo = false,
}: {
  href: string;
  label: string;
  Icon: typeof Home;
  active: boolean;
  badge?: number;
  novidade?: boolean;
  onNavigate?: () => void;
  sub?: boolean;
  /** item em vermelho: usado nos documentos legais, que são páginas públicas
   *  e não telas de administração */
  perigo?: boolean;
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
          perigo
            ? cn(
                "border border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300",
                active && "bg-red-500/15 text-red-300",
              )
            : active
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
        perigo
          ? cn(
              "border border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300",
              active && "bg-red-500/15 text-red-300",
            )
          : active
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
 * fecha também, EXCETO nos grupos `navegavel`, onde ele leva pra tela do grupo.
 * Com a barra recolhida sobra só o ícone, que leva pra tela do grupo (os
 * sub-itens não cabem numa coluna de ícones).
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
        {/* Por padrão o nome NÃO navega: só abre e fecha, porque a tela do grupo
            já é um dos atalhos logo abaixo. Nos grupos `navegavel` ele leva pra
            tela do grupo de propósito, pra quem clica no nome cair na porta de
            entrada em vez de só ver a listinha piscar. */}
        {grupo.navegavel ? (
          <Link href={grupo.raiz} onClick={onNavigate} className={classeNome}>
            <grupo.icon className="size-4.5" />
            {grupo.label}
          </Link>
        ) : (
          <button type="button" onClick={alternar} aria-expanded={aberto} className={classeNome}>
            <grupo.icon className="size-4.5" />
            {grupo.label}
          </button>
        )}
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

        {/* Personalize com IA, Viraliza Labs e Ferramentas: a setinha recolhe e
            expande os atalhos do grupo. O nome faz o mesmo, menos no Viraliza
            Labs, onde ele abre a tela do laboratório. */}
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

          {/* documentos legais: páginas PÚBLICAS, não telas de admin. Ficam no
              fim e em vermelho justamente pra não se misturar com as de cima. */}
          <div className="mt-3 flex flex-col gap-1">
            {compacto ? (
              <span className="mx-auto mb-1 h-px w-8 bg-red-500/30" />
            ) : (
              <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-red-400/70">
                Documentos legais
              </p>
            )}
            {docsLegaisItems.map(({ href, label, icon: Icon }) => (
              <Item
                key={href}
                href={href}
                label={label}
                Icon={Icon}
                active={isActive(href)}
                onNavigate={onNavigate}
                compacto={compacto}
                perigo
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
