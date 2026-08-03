"use client";

import { useEffect, useState } from "react";
import {
  Flame,
  Gift,
  Trophy,
  Wallet,
  Rocket,
  ExternalLink,
  Copy,
  Check,
  Crown,
  Medal,
  Users,
  Compass,
  BadgeDollarSign,
  Clock,
  Link2 as LinkIcon,
  MessageCircle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { LabDock, type ItemDock } from "@/components/app/lab-dock";
import type { Afiliado, MinhaAfiliacao } from "@/lib/afiliados";

/**
 * Indique e Ganhe: a pessoa se afilia ao Viraliza na Cakto e leva 50% de cada
 * venda que ela trouxer. A afiliação e o pagamento são da Cakto (a gente não
 * mexe em dinheiro); aqui é a vitrine, o passo a passo e o ranking.
 */

const COMISSAO = 50;
/** prêmio do primeiro que bater a meta (mexer aqui muda a tela inteira) */
const PREMIO = 100;
const META_VENDAS = 20;
/** preço base do Viraliza (o afiliado pode vender pelo dele, na aba "Minha afiliação") */
const PRECO = 98.9;
/** metade da venda, que é a comissão do afiliado (antes da taxa da Cakto) */
const GANHO_VENDA = PRECO / 2;

const LINK_AFILIACAO =
  "https://app.cakto.com.br/affiliate/invite/684a572c-0f5f-4b08-8df8-f175a3493ef1";

const PASSOS = [
  {
    Icone: ExternalLink,
    titulo: "Peça sua afiliação",
    texto: "Clique no botão, entre com a sua conta Cakto (ou crie na hora) e solicite a afiliação.",
  },
  {
    Icone: Check,
    titulo: "A gente aprova",
    texto: "Assim que aprovarmos, a Cakto gera o SEU link exclusivo do Viraliza.",
  },
  {
    Icone: Rocket,
    titulo: "Divulgue do seu jeito",
    texto: "Poste nos stories, mande no grupo, coloque na bio. Quem comprar pelo seu link é seu.",
  },
  {
    Icone: Wallet,
    titulo: "Receba na hora",
    texto: "A Cakto paga a sua comissão automaticamente. No Pix, cai na sua conta no mesmo dia.",
  },
];

const ABAS: ItemDock[] = [
  {
    chave: "programa",
    label: "O programa",
    Icone: Compass,
    descricao: "Como funciona, quanto rende e como se afiliar",
  },
  {
    chave: "minha",
    label: "Minha afiliação",
    Icone: BadgeDollarSign,
    descricao: "Sua página, as vendas que você trouxe e quanto já ganhou",
  },
];

// Onde a página de vendas mora. O afiliado divulga esta URL com o link dele.
const BASE_LP = "https://lp.viraliza.app.br";

/** "98,90" / "R$ 98.90" -> número em reais (0 se não der). */
function precoEmReais(raw: string): number {
  const n = parseFloat(String(raw || "").replace(/[^\d,.]/g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 && n < 100000 ? n : 0;
}

/** Codifica os dados do afiliado no formato que a página lê (?ck=, ?zap=, ?preco=). */
function montarLinkPagina(checkout: string, whatsapp: string, preco: string): string {
  const ck = btoa(unescape(encodeURIComponent(checkout.trim())))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const params = new URLSearchParams({ ck });
  const zap = String(whatsapp || "").replace(/\D/g, "");
  if (zap) params.set("zap", zap);
  const p = precoEmReais(preco);
  if (p) params.set("preco", p.toFixed(2));
  return `${BASE_LP}/?${params.toString()}`;
}

/** O link colado é MESMO um checkout de afiliado da Cakto? */
function checkoutValido(v: string): boolean {
  try {
    const u = new URL(v.trim());
    return u.hostname === "pay.cakto.com.br" && u.pathname.length > 1;
  } catch {
    return false;
  }
}

function reais(centavos: number) {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** medalha das três primeiras posições; o resto fica com o número mesmo */
function Posicao({ n }: { n: number }) {
  const estilos = [
    "border-amber-400/50 bg-amber-400/15 text-amber-300",
    "border-slate-300/40 bg-slate-300/10 text-slate-200",
    "border-orange-500/40 bg-orange-500/15 text-orange-300",
  ];
  if (n <= 3) {
    const Icone = n === 1 ? Crown : Medal;
    return (
      <span className={cn("grid size-9 place-items-center rounded-xl border", estilos[n - 1])}>
        <Icone className="size-4.5" />
      </span>
    );
  }
  return (
    <span className="grid size-9 place-items-center rounded-xl border border-border/60 bg-card/60 text-sm font-semibold text-muted-foreground">
      {n}
    </span>
  );
}

export function IndiqueGanhe({
  ranking,
  minha,
}: {
  ranking: Afiliado[];
  minha: MinhaAfiliacao;
}) {
  const [aba, setAba] = useState("programa");
  const [copiado, setCopiado] = useState(false);

  // "Minha página": o afiliado cola o checkout dele + WhatsApp e recebe o link
  // da página pronto. Fica guardado no navegador DELE (só ele vê), pra não ter
  // que digitar de novo toda vez.
  const [checkout, setCheckout] = useState("");
  const [zap, setZap] = useState("");
  const [preco, setPreco] = useState("");
  const [copiadoPagina, setCopiadoPagina] = useState(false);

  useEffect(() => {
    try {
      setCheckout(localStorage.getItem("afiliado-checkout") || "");
      setZap(localStorage.getItem("afiliado-zap") || "");
      setPreco(localStorage.getItem("afiliado-preco") || "");
    } catch {
      // navegador sem storage: só não lembra, tudo bem
    }
  }, []);

  const checkoutOk = checkoutValido(checkout);
  const linkPagina = checkoutOk ? montarLinkPagina(checkout, zap, preco) : "";

  function guardar(campo: "checkout" | "zap" | "preco", valor: string) {
    try {
      localStorage.setItem(`afiliado-${campo}`, valor);
    } catch {
      // sem storage: segue sem lembrar
    }
  }

  async function copiarPagina() {
    if (!linkPagina) return;
    try {
      await navigator.clipboard.writeText(linkPagina);
      setCopiadoPagina(true);
      toast.success("Link da sua página copiado!");
      setTimeout(() => setCopiadoPagina(false), 2500);
    } catch {
      toast.error("Não consegui copiar. Copie da caixa acima.");
    }
  }
  const lider = ranking[0] ?? null;
  // reembolsada não conta nem pro prêmio nem pro total
  const pagas = minha.vendas.filter((v) => v.status === "paid");

  async function copiarLink() {
    try {
      await navigator.clipboard.writeText(LINK_AFILIACAO);
      setCopiado(true);
      toast.success("Link copiado!");
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      toast.error("Não consegui copiar. Copie da barra de endereço.");
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5 pb-24">
      {aba === "programa" && (
        <>
      {/* ---------------------------------------------------- chamada */}
      <section className="relative overflow-hidden rounded-3xl border border-primary/30 bg-card/50 px-6 py-12 text-center shadow-[0_0_60px_-30px_var(--color-primary)] sm:px-10 sm:py-16">
        <span className="pointer-events-none absolute -top-24 left-1/2 size-72 -translate-x-1/2 rounded-full bg-orange-500/20 blur-3xl" />

        <div className="relative flex flex-col items-center gap-5">
          <span className="inline-flex items-center gap-2 rounded-full border border-orange-500/40 bg-orange-500/10 px-3 py-1.5 text-[11px] font-medium text-orange-300 sm:text-xs">
            <Flame className="size-3.5 fill-amber-400 text-orange-500" />
            Programa de indicação
          </span>

          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Indique o Viraliza e ganhe{" "}
            <span className="text-primary">comissão de verdade</span>
          </h1>

          {/* o número é o argumento: fica gigante */}
          <div className="flex flex-col items-center gap-1">
            <p className="bg-gradient-to-b from-orange-300 to-orange-600 bg-clip-text text-6xl font-black tracking-tight text-transparent drop-shadow-[0_0_28px_rgba(249,115,22,0.55)] sm:text-8xl">
              {COMISSAO}%
            </p>
            <p className="text-sm font-medium text-muted-foreground">
              de comissão em cada venda
            </p>
          </div>

          <p className="max-w-xl text-sm text-muted-foreground sm:text-base">
            Metade de cada venda é sua. São cerca de{" "}
            <span className="font-semibold text-foreground">
              {GANHO_VENDA.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </span>{" "}
            por pessoa que entrar pelo seu link, e o pagamento cai automático.
          </p>

          <div className="flex w-full flex-col items-center gap-2 sm:w-auto sm:flex-row">
            <a
              href={LINK_AFILIACAO}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-3.5 text-sm font-bold text-white shadow-[0_0_35px_-8px_rgba(249,115,22,0.9)] transition-all hover:opacity-90 hover:shadow-[0_0_45px_-6px_rgba(249,115,22,1)] sm:w-auto"
            >
              <Flame className="size-4.5 fill-amber-200" />
              Quero me afiliar agora
            </a>
            <button
              type="button"
              onClick={copiarLink}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground sm:w-auto"
            >
              {copiado ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copiado ? "Copiado!" : "Copiar link"}
            </button>
          </div>

          <p className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-xs font-medium text-amber-300">
            <Gift className="size-3.5" />
            E R$ {PREMIO},00 de prêmio pro primeiro que bater {META_VENDAS} vendas
          </p>

          <p className="text-xs text-muted-foreground">
            A afiliação e o pagamento são feitos pela Cakto, a mesma plataforma do nosso checkout.
          </p>
        </div>
      </section>

      {/* ---------------------------------------------------- conta simples */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { n: "1 venda", v: "R$ 49,45", t: "na sua conta" },
          { n: "10 vendas", v: "R$ 494,50", t: "só divulgando" },
          { n: "30 vendas", v: "R$ 1.483,50", t: "uma por dia no mês" },
        ].map((c) => (
          <div
            key={c.n}
            className="rounded-2xl border border-border/60 bg-card/40 p-4 text-center"
          >
            <p className="text-xs font-medium text-muted-foreground">{c.n}</p>
            <p className="mt-1 text-2xl font-bold text-primary">{c.v}</p>
            <p className="text-xs text-muted-foreground">{c.t}</p>
          </div>
        ))}
      </div>

      {/* ---------------------------------------------------- passo a passo */}
      <section className="rounded-2xl border border-border/60 bg-card/40 p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Rocket className="size-4 text-primary" />
          Como começar
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {PASSOS.map((p, i) => (
            <div key={p.titulo} className="flex gap-3 rounded-xl border border-border/50 bg-background/40 p-3.5">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
                <p.Icone className="size-4.5" />
              </span>
              <div>
                <p className="text-sm font-semibold">
                  {i + 1}. {p.titulo}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{p.texto}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------- ranking */}
      <section className="rounded-2xl border border-border/60 bg-card/40 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Trophy className="size-4 text-amber-400" />
            Ranking dos que mais indicam
          </h2>
          <span className="text-[11px] text-muted-foreground">últimos 30 dias</span>
        </div>

        {/* prêmio em dinheiro pra quem chegar na frente: é o que faz o ranking
            valer a pena de olhar (e o líder aparece correndo atrás da meta) */}
        <div className="mt-4 overflow-hidden rounded-2xl border border-amber-400/40 bg-gradient-to-br from-amber-400/10 to-orange-500/5 p-4">
          <div className="flex items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-amber-400/40 bg-amber-400/15 text-amber-300 shadow-[0_0_25px_-8px_rgba(251,191,36,0.9)]">
              <Gift className="size-5.5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold">
                <span className="text-amber-300">R$ {PREMIO},00 de prêmio</span> pra quem chegar
                primeiro
              </p>
              <p className="text-xs text-muted-foreground">
                O primeiro afiliado a fechar {META_VENDAS} vendas leva o prêmio, além das comissões
                de sempre.
              </p>
            </div>
          </div>

          {lider && (
            <div className="mt-3.5">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>
                  Líder agora: <span className="font-medium text-foreground">{lider.apelido}</span>
                </span>
                <span>
                  {Math.min(lider.vendas, META_VENDAS)}/{META_VENDAS} vendas
                </span>
              </div>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-background/60">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all"
                  style={{ width: `${Math.min(100, (lider.vendas / META_VENDAS) * 100)}%` }}
                />
              </div>
              {lider.vendas >= META_VENDAS && (
                <p className="mt-2 text-xs font-semibold text-amber-300">
                  Meta batida! O prêmio já tem dono nesta rodada.
                </p>
              )}
            </div>
          )}
        </div>

        {ranking.length === 0 ? (
          <div className="mt-6 flex flex-col items-center gap-2 py-8 text-center">
            <span className="grid size-14 place-items-center rounded-2xl border border-orange-500/30 bg-orange-500/10">
              <Flame className="size-7 fill-amber-400 text-orange-500 drop-shadow-[0_0_8px_rgba(249,115,22,0.8)]" />
            </span>
            <p className="text-sm font-semibold">O ranking está vazio</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              Ninguém começou ainda. Se afilie agora e seja a primeira pessoa a aparecer aqui no
              topo.
            </p>
          </div>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {ranking.map((a) => (
              <li
                key={a.posicao}
                className={cn(
                  "flex items-center gap-3 rounded-xl border p-3",
                  a.posicao === 1
                    ? "border-amber-400/40 bg-amber-400/5"
                    : "border-border/50 bg-background/40",
                )}
              >
                <Posicao n={a.posicao} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{a.apelido}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.vendas} {a.vendas === 1 ? "venda" : "vendas"}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-bold text-primary">
                  {reais(a.comissaoCentavos)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---------------------------------------------------- regras */}
      <section className="rounded-2xl border border-border/60 bg-card/40 p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Users className="size-4 text-primary" />
          Como funciona a comissão
        </h2>
        <ul className="mt-3 flex flex-col gap-2 text-xs leading-relaxed text-muted-foreground">
          <li>
            A pessoa que clica no seu link fica marcada como sua. Se ela comprar, a comissão de{" "}
            <span className="font-semibold text-foreground">{COMISSAO}%</span> é sua
            automaticamente.
          </li>
          <li>
            O acesso custa{" "}
            {PRECO.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}, então a sua
            metade dá{" "}
            {GANHO_VENDA.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} por venda
            (menos a pequena taxa da Cakto, descontada na hora do repasse).
          </li>
          <li>Quem paga você é a Cakto, direto na sua conta, sem passar por nós.</li>
          <li>
            Venda reembolsada dentro da garantia de 7 dias não gera comissão, como em qualquer
            programa de afiliados.
          </li>
        </ul>
      </section>
        </>
      )}

      {aba === "minha" && (
        <section className="space-y-4">
          {/* A SUA página de vendas: cola o link de afiliado e leva o link pronto */}
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-xl bg-primary/10">
                <LinkIcon className="size-5 text-primary" />
              </span>
              <div>
                <h2 className="text-base font-semibold tracking-tight">Sua página de vendas</h2>
                <p className="text-sm text-muted-foreground">
                  A mesma página do Viraliza, só que com o SEU link.
                </p>
              </div>
            </div>

            <label className="mt-5 block text-sm font-medium" htmlFor="af-checkout">
              1. Seu link de afiliado da Cakto
            </label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              O link que a Cakto te deu depois de aprovarmos a sua afiliação
              (começa com pay.cakto.com.br).
            </p>
            <input
              id="af-checkout"
              type="url"
              inputMode="url"
              placeholder="https://pay.cakto.com.br/..."
              value={checkout}
              onChange={(e) => {
                setCheckout(e.target.value);
                guardar("checkout", e.target.value);
              }}
              className={cn(
                "mt-2 w-full rounded-xl border bg-background px-3 py-3 text-sm outline-none transition",
                checkout && !checkoutOk
                  ? "border-red-500/60 focus:border-red-500"
                  : "border-border focus:border-primary/50",
              )}
            />
            {checkout && !checkoutOk && (
              <p className="mt-2 text-xs text-red-500">
                Esse não parece o link de afiliado da Cakto. Ele começa com
                pay.cakto.com.br. Copie de novo lá no seu painel da Cakto.
              </p>
            )}

            <label className="mt-5 block text-sm font-medium" htmlFor="af-preco">
              2. O preço do seu produto
            </label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              É o valor que está no SEU checkout. A página inteira passa a mostrar
              esse preço. Importante preencher: em branco, ela mostra R$ 37,90.
            </p>
            <div className="mt-2 flex items-center gap-2 rounded-xl border border-border bg-background px-3 focus-within:border-primary/50">
              <span className="shrink-0 text-sm text-muted-foreground">R$</span>
              <input
                id="af-preco"
                type="text"
                inputMode="decimal"
                placeholder="98,90"
                value={preco}
                onChange={(e) => {
                  setPreco(e.target.value);
                  guardar("preco", e.target.value);
                }}
                className="w-full bg-transparent py-3 text-sm outline-none"
              />
            </div>

            <label className="mt-5 block text-sm font-medium" htmlFor="af-zap">
              3. Seu WhatsApp{" "}
              <span className="font-normal text-muted-foreground">(opcional)</span>
            </label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Se preencher, o botão de WhatsApp da sua página fala com você. Se
              deixar em branco, fala com o suporte do Viraliza.
            </p>
            <div className="mt-2 flex items-center gap-2 rounded-xl border border-border bg-background px-3 focus-within:border-primary/50">
              <MessageCircle className="size-4 shrink-0 text-muted-foreground" />
              <input
                id="af-zap"
                type="tel"
                inputMode="numeric"
                placeholder="(11) 99999-9999"
                value={zap}
                onChange={(e) => {
                  setZap(e.target.value);
                  guardar("zap", e.target.value);
                }}
                className="w-full bg-transparent py-3 text-sm outline-none"
              />
            </div>

            {checkoutOk ? (
              <div className="mt-5 rounded-xl border border-primary/40 bg-background p-4">
                <p className="text-sm font-medium text-primary">Pronto! Esta é a sua página</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Copie e divulgue este link. É ele que vende pra você.
                </p>
                <div className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
                  <span className="min-w-0 flex-1 truncate text-sm">{linkPagina}</span>
                  <button
                    type="button"
                    onClick={copiarPagina}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:opacity-90"
                  >
                    {copiadoPagina ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                    {copiadoPagina ? "Copiado" : "Copiar"}
                  </button>
                </div>
                <a
                  href={linkPagina}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  Abrir e conferir <ExternalLink className="size-3.5" />
                </a>
              </div>
            ) : (
              <p className="mt-4 text-xs text-muted-foreground">
                Assim que você colar o seu link acima, a sua página aparece aqui
                pronta pra copiar.
              </p>
            )}
          </div>

          {/* resumo do que essa pessoa já fez */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-border/60 bg-card/40 p-4 text-center">
              <p className="text-xs font-medium text-muted-foreground">Vendas pelo seu link</p>
              <p className="mt-1 text-3xl font-bold">{pagas.length}</p>
            </div>
            <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 text-center">
              <p className="text-xs font-medium text-muted-foreground">Você já ganhou</p>
              <p className="mt-1 text-3xl font-bold text-primary">{reais(minha.totalCentavos)}</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-card/40 p-4 text-center">
              <p className="text-xs font-medium text-muted-foreground">Sua posição</p>
              <p className="mt-1 text-3xl font-bold">
                {minha.posicao ? `${minha.posicao}º` : "-"}
              </p>
            </div>
          </div>

          {/* corrida pelo prêmio, do ponto de vista dela */}
          <div className="rounded-2xl border border-amber-400/40 bg-gradient-to-br from-amber-400/10 to-orange-500/5 p-4">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 font-semibold text-amber-300">
                <Gift className="size-3.5" />
                Prêmio de R$ {PREMIO},00
              </span>
              <span className="text-muted-foreground">
                {Math.min(pagas.length, META_VENDAS)}/{META_VENDAS} vendas
              </span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-background/60">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all"
                style={{ width: `${Math.min(100, (pagas.length / META_VENDAS) * 100)}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {pagas.length >= META_VENDAS
                ? "Você bateu a meta! Fala com a gente pra receber o prêmio."
                : `Faltam ${META_VENDAS - pagas.length} vendas pra você levar o prêmio.`}
            </p>
          </div>

          {/* histórico */}
          <div className="rounded-2xl border border-border/60 bg-card/40 p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Clock className="size-4 text-primary" />
              Suas indicações
            </h2>

            {minha.vendas.length === 0 ? (
              <div className="mt-5 flex flex-col items-center gap-2 py-8 text-center">
                <span className="grid size-14 place-items-center rounded-2xl border border-border/60 bg-background/50">
                  <BadgeDollarSign className="size-7 text-muted-foreground" />
                </span>
                <p className="text-sm font-semibold">Nenhuma venda ainda</p>
                <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
                  Assim que alguém comprar pelo seu link de afiliado, a venda aparece aqui com a
                  sua comissão. Procuramos pelo e-mail{" "}
                  <span className="font-medium text-foreground">{minha.email}</span>, então use ele
                  também na sua conta da Cakto.
                </p>
                <button
                  type="button"
                  onClick={() => setAba("programa")}
                  className="mt-1 inline-flex items-center gap-2 rounded-xl border border-primary/40 px-4 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                >
                  <Flame className="size-3.5" />
                  Ver como me afiliar
                </button>
              </div>
            ) : (
              <ul className="mt-4 flex flex-col gap-2">
                {minha.vendas.map((v) => {
                  const perdida = v.status !== "paid";
                  return (
                    <li
                      key={v.refId}
                      className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/40 p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{v.produto}</p>
                        <p className="text-xs text-muted-foreground">
                          {v.quando
                            ? new Date(v.quando).toLocaleDateString("pt-BR", {
                                day: "2-digit",
                                month: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : ""}
                          {perdida && " · reembolsada"}
                        </p>
                      </div>
                      <p
                        className={cn(
                          "shrink-0 text-sm font-bold",
                          perdida ? "text-muted-foreground line-through" : "text-primary",
                        )}
                      >
                        {reais(v.comissaoCentavos)}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      )}


      <LabDock itens={ABAS} atual={aba} onTrocar={setAba} />
    </div>
  );
}
