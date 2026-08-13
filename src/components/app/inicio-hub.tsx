import Link from "next/link";
import {
  ArrowRight,
  Clapperboard,
  Coins,
  Compass,
  Crown,
  Film,
  Flame,
  Gift,
  GraduationCap,
  Image as ImageIcon,
  Images,
  LayoutGrid,
  LifeBuoy,
  MapPin,
  MessageSquarePlus,
  Newspaper,
  PenLine,
  Pickaxe,
  Receipt,
  Scissors,
  SlidersHorizontal,
  Sparkles,
  Stamp,
  User,
  UserRound,
  Video,
  Wand2,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { CategoriaCard } from "@/components/hub/categoria-card";
import { cn } from "@/lib/utils";

/**
 * Catálogo da tela de Início: TODAS as opções da plataforma, agrupadas pelo que
 * a pessoa quer fazer.
 *
 * Por que ela é assim: a Início antiga mostrava só o acervo, três ferramentas e
 * os ebooks. Ficava de fora praticamente tudo que a plataforma virou depois
 * (Viraliza Labs, Viral Boost, Personalize com IA, Minerador, marca em lote,
 * produtos do TikTok, assinatura, créditos, ajuda, indicação), e três cartões do
 * acervo levavam todos pro MESMO lugar com nomes diferentes. Quem entrava não
 * tinha como saber o que existia.
 *
 * Cada cartão diz o que a ferramenta FAZ, não só o nome dela: os nomes não se
 * explicam sozinhos (ninguém adivinha a diferença entre "Criar criativo" e
 * "Vídeo livre"). Mesma ideia da tela de apresentação do Labs.
 *
 * NENHUM cartão anuncia preço, de propósito. O valor aparece na hora de gerar,
 * que é onde ele é cobrado, e assim esta tela não vira mais um lugar pra
 * desatualizar quando um preço mudar (já aconteceu com o Gerador de prompt).
 *
 * Os ícones são os MESMOS do menu lateral de propósito: quem viu o cartão aqui
 * reconhece o item na barra depois.
 *
 * Server Component: é texto e link, então a tela toda não manda JS pro navegador.
 */

type Tom = "novo" | "assinante" | "breve";

type Cartao = {
  href: string;
  titulo: string;
  Icone: LucideIcon;
  descricao: string;
  selo?: { texto: string; tom: Tom };
  /** cartão em destaque (a porta de entrada da seção) */
  destaque?: boolean;
};

const TONS: Record<Tom, string> = {
  novo: "bg-orange-500/15 text-orange-400",
  assinante: "bg-amber-500/15 text-amber-400",
  breve: "bg-muted text-muted-foreground",
};

function CartaoInicio({ href, titulo, Icone, descricao, selo, destaque }: Cartao) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex flex-col gap-2.5 rounded-2xl border p-4 transition-all hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-[0_0_30px_-12px_var(--color-primary)]",
        destaque
          ? "border-primary/40 bg-primary/[0.06]"
          : "border-border bg-card/60",
      )}
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-xl",
            destaque ? "bg-primary text-primary-foreground" : "bg-primary/15 text-primary",
          )}
        >
          <Icone className="size-5" />
        </span>
        <p className="text-sm font-bold leading-tight">{titulo}</p>
        {selo && (
          <span
            className={cn(
              "ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
              TONS[selo.tom],
            )}
          >
            {selo.texto}
          </span>
        )}
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">{descricao}</p>

      <span className="mt-auto inline-flex items-center gap-1.5 pt-1 text-xs font-semibold text-primary">
        Abrir
        <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

function Secao({
  id,
  titulo,
  chamada,
  Icone,
  children,
}: {
  id: string;
  titulo: string;
  chamada: string;
  Icone: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 space-y-3">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <Icone className="size-5 text-primary" />
          {titulo}
        </h2>
        <p className="text-sm text-muted-foreground">{chamada}</p>
      </div>
      {children}
    </section>
  );
}

const GRADE = "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

// ---------------------------------------------------------------------------
// 1. Criar com IA (Viraliza Labs + Viral Boost + Personalize com IA)
// ---------------------------------------------------------------------------
const CRIAR: Cartao[] = [
  {
    href: "/painel/lab",
    titulo: "Criar criativo",
    Icone: Compass,
    descricao:
      "O caminho guiado do Viraliza Labs: escolha o produto, o influenciador e o cenário, e saia com o vídeo pronto. É por aqui que quase todo mundo começa.",
    destaque: true,
  },
  {
    href: "/painel/lab/livre",
    titulo: "Vídeo livre",
    Icone: Video,
    descricao:
      "Sem passo a passo: você escreve com as suas palavras o vídeo que quer, anexa as imagens de referência e a IA grava aquilo.",
  },
  {
    href: "/painel/viral-boost",
    titulo: "Viral Boost",
    Icone: Flame,
    descricao:
      "Historinhas virais em 5 passos, com aqueles personagens que já bombam. Escolha uma pronta ou deixe a IA escrever a sua.",
    selo: { texto: "Novo", tom: "novo" },
  },
  {
    href: "/painel/meus-avatares/criar",
    titulo: "Novo influenciador",
    Icone: Sparkles,
    descricao:
      "Crie a pessoa que aparece nos seus vídeos: por um quiz, a partir de uma foto sua ou já segurando o seu produto.",
  },
  {
    href: "/painel/meus-avatares",
    titulo: "Galeria de avatares",
    Icone: UserRound,
    descricao:
      "Seus influenciadores ficam salvos aqui, junto com 9 prontos da plataforma que você usa de graça quando quiser.",
  },
  {
    href: "/painel/meus-avatares/cenarios",
    titulo: "Meus cenários",
    Icone: ImageIcon,
    descricao:
      "Os lugares onde os seus vídeos acontecem. Suba o seu cenário uma vez e reaproveite ele em qualquer criação.",
  },
  {
    href: "/painel/lab/imagens",
    titulo: "Minhas imagens",
    Icone: Images,
    descricao:
      "Tudo que você já gerou fica guardado. Dá pra baixar, favoritar e gerar um vídeo novo de uma imagem sem pagar ela outra vez.",
  },
  {
    href: "/painel/lab/prompt",
    titulo: "Gerador de prompt",
    Icone: PenLine,
    descricao:
      "Suba as suas fotos e a IA escreve a descrição técnica do vídeo, do jeito que os profissionais escrevem.",
  },
];

// ---------------------------------------------------------------------------
// 2. Ferramentas (pipeline antigo + prospecção)
// ---------------------------------------------------------------------------
function ferramentas(bibliotecaLiberada: boolean): Cartao[] {
  return [
    {
      href: "/painel/novo",
      titulo: "Editor automático PRO",
      Icone: Wand2,
      descricao:
        "Suba os seus vídeos e a plataforma monta um só: corte, legenda, voz, música e a copy escrita pela IA. Vai em 5 etapas.",
      destaque: true,
    },
    // Mesma ferramenta, tela diferente (12/08/2026): o Basic é a versão de
    // página única. Sem `destaque`, porque o caminho recomendado é o PRO.
    {
      href: "/painel/editor-basico",
      titulo: "Editor automático BASIC",
      Icone: SlidersHorizontal,
      descricao:
        "O mesmo editor numa tela só, sem passo a passo. Pra quem já sabe o que quer e prefere mexer em tudo de uma vez.",
    },
    {
      href: "/painel/criar-corte",
      titulo: "Criar um Corte",
      Icone: Scissors,
      descricao:
        "Suba um vídeo do seu computador, tire os pedaços que não presta e o silêncio entre as falas. Sem IA, sai na hora.",
    },
    {
      href: "/painel/cortes",
      titulo: "Cortes de qualquer vídeo",
      Icone: Clapperboard,
      descricao:
        "Cole o link de um vídeo e a IA escolhe os melhores momentos, corta no formato de celular e legenda pra você.",
    },
    {
      href: "/painel/lote",
      titulo: "Aplicar marca em lote",
      Icone: Stamp,
      descricao:
        "Carimbe a sua logo em vários vídeos de uma vez, na posição e no tamanho que você escolher.",
    },
    {
      href: "/painel/leads",
      titulo: "MapsLeads",
      Icone: MapPin,
      descricao:
        "Ache empresas de um nicho e de uma cidade, com telefone e endereço, prontas pra você prospectar.",
    },
    {
      href: "/painel/minerador",
      titulo: "Minerador de produtos",
      Icone: Pickaxe,
      descricao:
        "Converse com a IA e descubra o que está vendendo no seu nicho antes de todo mundo saturar.",
      // ele entrega os vídeos da biblioteca, então segue a mesma trava dela
      selo: bibliotecaLiberada
        ? undefined
        : { texto: "Assinantes", tom: "assinante" },
    },
  ];
}

// ---------------------------------------------------------------------------
// 4. Conta, ajuda e o resto
// ---------------------------------------------------------------------------
function conta(blogTemArtigo: boolean): Cartao[] {
  return [
    {
      href: "/painel",
      titulo: "Meus vídeos",
      Icone: LayoutGrid,
      descricao:
        "Tudo que você já criou, pronto pra baixar. É aqui que você acompanha o que ainda está sendo gerado.",
      destaque: true,
    },
    {
      href: "/painel/assinatura",
      titulo: "Assinatura",
      Icone: Crown,
      descricao:
        "Veja até quando a sua assinatura vale e renove antes de vencer, pra não perder o acesso à biblioteca.",
    },
    {
      href: "/painel/creditos",
      titulo: "Créditos",
      Icone: Coins,
      descricao:
        "Compre crédito pra continuar produzindo e entenda quanto custa cada coisa antes de gerar.",
    },
    {
      href: "/painel/extrato",
      titulo: "Extrato",
      Icone: Receipt,
      descricao:
        "Cada entrada e cada gasto da sua conta, em ordem, com o que foi gerado em cada um.",
    },
    {
      href: "/painel/ajuda",
      titulo: "Central de Ajuda",
      Icone: LifeBuoy,
      descricao:
        "O manual completo em uma página: como usar cada ferramenta, quanto custa e o que fazer quando algo dá errado.",
    },
    {
      href: "/painel/indique",
      titulo: "Indique e Ganhe",
      Icone: Gift,
      descricao:
        "Divulgue a plataforma com o seu link e receba comissão por cada pessoa que entrar por ele.",
    },
    {
      href: "/painel/sugestoes",
      titulo: "Sugestões",
      Icone: MessageSquarePlus,
      descricao:
        "Peça uma funcionalidade nova ou avise de um problema. Sugestão aproveitada rende crédito pra você.",
    },
    {
      href: "/painel/conta",
      titulo: "Minha conta",
      Icone: User,
      descricao:
        "Seus dados, sua senha, o seu nível na plataforma e as chaves próprias de API.",
    },
    {
      href: "/painel/blog",
      titulo: "Blog",
      Icone: Newspaper,
      descricao:
        "Artigos curtos com o que está funcionando agora e as novidades da plataforma antes de todo mundo.",
      // sem artigo nenhum em `lib/blog.ts`, a tela ainda é o "em breve"
      selo: blogTemArtigo ? undefined : { texto: "Em breve", tom: "breve" },
    },
    {
      href: "/painel/academy",
      titulo: "Viraliza Academy",
      Icone: GraduationCap,
      descricao:
        "As aulas que ensinam a vender de verdade com os criativos que você gera aqui, do primeiro vídeo até escalar.",
      selo: { texto: "Em breve", tom: "breve" },
    },
  ];
}

/** Atalhos pras seções, logo abaixo do herói (âncora pura, sem JS). */
const ATALHOS = [
  { href: "#criar", label: "Criar com IA", Icone: Sparkles },
  { href: "#ferramentas", label: "Ferramentas", Icone: Wrench },
  { href: "#biblioteca", label: "Biblioteca", Icone: Film },
  { href: "#conta", label: "Conta e ajuda", Icone: UserRound },
];

export function InicioAtalhos() {
  return (
    <div className="flex flex-wrap gap-2">
      {ATALHOS.map(({ href, label, Icone }) => (
        <a
          key={href}
          href={href}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
        >
          <Icone className="size-3.5" />
          {label}
        </a>
      ))}
    </div>
  );
}

export function InicioCatalogo({
  bibliotecaLiberada,
  blogTemArtigo,
  totalVirais,
  totalProdutos,
  totalAcervo,
  totalCategorias,
}: {
  bibliotecaLiberada: boolean;
  blogTemArtigo: boolean;
  totalVirais: number;
  totalProdutos: number;
  totalAcervo: number;
  totalCategorias: number;
}) {
  const fmt = (n: number) => n.toLocaleString("pt-BR");
  // sem assinatura ativa, a biblioteca continua aparecendo (com a etiqueta):
  // esconder faria a pessoa nem saber que aquilo existe pra assinar.
  const seloBiblioteca = bibliotecaLiberada ? undefined : "Assinantes";

  return (
    <div className="space-y-8">
      <Secao
        id="criar"
        titulo="Criar com IA"
        chamada="A IA grava o vídeo pra você. Não precisa aparecer, nem ter câmera, nem gravar nada."
        Icone={Sparkles}
      >
        <div className={GRADE}>
          {CRIAR.map((c) => (
            <CartaoInicio key={c.href} {...c} />
          ))}
        </div>
      </Secao>

      <Secao
        id="ferramentas"
        titulo="Ferramentas"
        chamada="Pra trabalhar o vídeo que você já tem e achar o seu próximo cliente."
        Icone={Wrench}
      >
        <div className={GRADE}>
          {ferramentas(bibliotecaLiberada).map((c) => (
            <CartaoInicio key={c.href} {...c} />
          ))}
        </div>
      </Secao>

      <Secao
        id="biblioteca"
        titulo="Biblioteca"
        chamada={
          bibliotecaLiberada
            ? "Conteúdo pronto pra baixar e postar, sem gravar nada."
            : "Conteúdo pronto pra baixar e postar. Libera com a assinatura ativa."
        }
        Icone={Film}
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <CategoriaCard
            href="/painel/shopee"
            titulo="Shopee"
            subtitulo={`+${fmt(totalVirais)} vídeos e +${fmt(totalProdutos)} produtos`}
            capa="/capas/shopee.png"
            selo={seloBiblioteca}
          />
          <CategoriaCard
            href="/painel/tiktok"
            titulo="Produtos TikTok"
            subtitulo="O que vende no TikTok Shop"
            capa="/capas/tiktok.png"
            selo={seloBiblioteca}
          />
          <CategoriaCard
            href="/painel/acervo"
            titulo="Acervo de cortes"
            subtitulo={`+${fmt(totalAcervo)} cortes em ${totalCategorias} categorias`}
            capa="/capas/acervo.png"
            selo={seloBiblioteca}
          />
          <CategoriaCard
            href="/painel/membro"
            titulo="Área Membro"
            subtitulo="Ebooks e tutoriais pra vender mais"
            capa="/capas/vendernashope.png"
            selo={seloBiblioteca}
          />
        </div>
      </Secao>

      <Secao
        id="conta"
        titulo="Conta e ajuda"
        chamada="Seu saldo, sua assinatura e onde tirar dúvida quando travar."
        Icone={UserRound}
      >
        <div className={GRADE}>
          {conta(blogTemArtigo).map((c) => (
            <CartaoInicio key={c.href} {...c} />
          ))}
        </div>
      </Secao>
    </div>
  );
}
