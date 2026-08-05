"use client";

import { useEffect, useMemo, useState } from "react";
import {
  UserRound,
  Palette,
  Dumbbell,
  Scissors,
  Wand2,
  Shirt,
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Sparkles,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { cn, linkBaixar } from "@/lib/utils";
import {
  midiaPele,
  midiaCorpo,
  midiaCabeloCor,
  midiaCabeloEstilo,
  CORPOS_COM_IMAGEM,
} from "@/lib/lab-midia";
import {
  GENEROS,
  TONS_PELE,
  TIPOS_FISICOS,
  CABELO_CORES,
  estilosDeCabelo,
  CAMISAS,
  CAMISA_TIPOS,
  CUSTO_AVATAR,
  tipoFisicoNoGenero,
  type Opcao,
  type EscolhasAvatar,
} from "@/lib/avatar-modelo";
import type { AvatarCriado } from "@/lib/avatar-modelo";

/**
 * "Novo influenciador": monta o influenciador em 7 passos, cada um com a sua caixa e a
 * trilha numerada em cima. Substituiu o quiz de uma pergunta por tela: aqui a
 * pessoa vê o caminho inteiro e volta em qualquer passo com um clique.
 *
 * O passo da CAMISA existe porque é o que mais aparece no card e o que mais
 * atrapalha o vídeo depois: camisa estampada rouba a atenção do produto.
 */

const INICIAL: EscolhasAvatar = {
  nome: "",
  genero: "female",
  idade: 25,
  tomPele: "morena",
  formatoRosto: "oval", // não perguntamos: o padrão funciona bem em todos
  olhos: "castanho_escuro",
  cabeloCor: "castanho",
  cabeloEstilo: "long_straight",
  cabeloComprimento: "ombro",
  cabeloTextura: "ondulado",
  tipoFisico: "magra",
  expressao: "sorriso_leve",
  maquiagem: "leve",
  marcas: "",
  cenario: "quarto",
  estilo: "natural",
  camisa: "preta",
  camisaTipo: "basica",
  barba: false,
  oculos: false,
};

const PASSOS = [
  { chave: "identidade", label: "Identidade", Icone: UserRound },
  { chave: "pele", label: "Tom de pele", Icone: Palette },
  { chave: "fisico", label: "Tipo físico", Icone: Dumbbell },
  { chave: "cabeloCor", label: "Cor do cabelo", Icone: Palette },
  { chave: "cabeloEstilo", label: "Estilo do cabelo", Icone: Scissors },
  { chave: "detalhes", label: "Detalhes", Icone: Wand2 },
  { chave: "camisa", label: "Camisa", Icone: Shirt },
] as const;

/** Trilha numerada do topo, com a linha de progresso embaixo. */
function Trilha({
  atual,
  onIr,
}: {
  atual: number;
  onIr: (i: number) => void;
}) {
  const pct = ((atual + 1) / PASSOS.length) * 100;
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {PASSOS.map((p, i) => {
          const feito = i < atual;
          const ativo = i === atual;
          return (
            <div key={p.chave} className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => onIr(i)}
                disabled={i > atual}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-medium transition-colors sm:text-xs",
                  ativo
                    ? "border-primary/60 bg-primary/12 text-primary"
                    : feito
                      ? "border-primary/25 text-primary/70 hover:border-primary/50"
                      : "border-border/60 text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "grid size-4 shrink-0 place-items-center rounded-full text-[9px] font-bold",
                    ativo || feito
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {feito ? <Check className="size-2.5" /> : i + 1}
                </span>
                {p.label}
              </button>
              {i < PASSOS.length - 1 && (
                <span className={cn("h-px w-3 sm:w-6", feito ? "bg-primary/40" : "bg-border/60")} />
              )}
            </div>
          );
        })}
      </div>
      <div className="h-0.5 w-full overflow-hidden rounded-full bg-border/60">
        <div
          className="h-full rounded-full bg-primary shadow-[0_0_10px_var(--color-primary)] transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/** Grade de opções (cada uma vira um botão grande). */
function Opcoes({
  opcoes,
  valor,
  onEscolher,
  colunas = "sm:grid-cols-3",
}: {
  opcoes: Opcao[];
  valor: string;
  onEscolher: (chave: string) => void;
  colunas?: string;
}) {
  return (
    <div className={cn("grid grid-cols-2 gap-2.5", colunas)}>
      {opcoes.map((o) => {
        const ativo = valor === o.chave;
        return (
          <button
            key={o.chave}
            type="button"
            onClick={() => onEscolher(o.chave)}
            aria-pressed={ativo}
            className={cn(
              "rounded-xl border px-3 py-3 text-sm font-medium transition-all",
              ativo
                ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/30"
                : "border-border/60 hover:border-primary/40 hover:bg-card",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Caixa de um passo: ícone, título e o conteúdo. */
function Caixa({
  Icone,
  titulo,
  children,
}: {
  Icone: typeof UserRound;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border/70 bg-card/60 p-5 backdrop-blur-sm sm:p-6">
      <h2 className="flex items-center gap-2 font-semibold">
        <Icone className="size-4 text-primary" />
        {titulo}
      </h2>
      <div className="mt-4 space-y-5">{children}</div>
    </section>
  );
}

/** Interruptor de sim ou nao (barba, oculos). */
function Chave({
  rotulo,
  descricao,
  ligado,
  onMudar,
}: {
  rotulo: string;
  descricao: string;
  ligado: boolean;
  onMudar: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      onClick={() => onMudar(!ligado)}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition-colors",
        ligado ? "border-primary/50 bg-primary/8" : "border-border/60 hover:border-primary/40",
      )}
    >
      <span className="min-w-0 flex-1">
        <span className={cn("block text-sm font-medium", ligado && "text-primary")}>{rotulo}</span>
        <span className="block text-xs text-muted-foreground">{descricao}</span>
      </span>
      <span
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors",
          ligado ? "bg-primary" : "bg-muted",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-5 rounded-full bg-white transition-all",
            ligado ? "left-[22px]" : "left-0.5",
          )}
        />
      </span>
    </button>
  );
}

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{rotulo}</p>
      {children}
    </div>
  );
}

/**
 * Marca no navegador que TEM um influenciador sendo criado agora. A criação é
 * um pedido longo (1-3 min): se a pessoa sair da tela no meio, a resposta se
 * perde, mas o influenciador ENTRA na lista dela do mesmo jeito. Sem essa
 * marca, ela voltava, criava de novo e pagava duas vezes.
 */
const CHAVE_CRIANDO = "avatar-criando-em";
const VALIDADE_CRIANDO_MS = 8 * 60_000;

export function avatarCriandoAgora(): boolean {
  try {
    const t = Number(localStorage.getItem(CHAVE_CRIANDO) || 0);
    return t > 0 && Date.now() - t < VALIDADE_CRIANDO_MS;
  } catch {
    return false;
  }
}

export function AvatarCriar({
  onSair,
  onCriado,
  admin = false,
}: {
  onSair: () => void;
  onCriado?: (a: AvatarCriado) => void;
  admin?: boolean;
}) {
  const [e, setE] = useState<EscolhasAvatar>(INICIAL);
  const [i, setI] = useState(0);
  const [enviando, setEnviando] = useState(false);
  // o que a pessoa está DIGITANDO na idade: só vira número (e trava 18-75) ao
  // sair do campo — travar a cada tecla impedia até apagar pra digitar outra
  const [idadeTxt, setIdadeTxt] = useState(String(INICIAL.idade));
  const [criado, setCriado] = useState<AvatarCriado | null>(null);
  // já existe uma criação rodando (a pessoa saiu no meio e voltou)?
  const [avisoCriando, setAvisoCriando] = useState(false);

  useEffect(() => {
    setAvisoCriando(avatarCriandoAgora());
  }, []);

  const female = e.genero === "female";
  const temManequim = CORPOS_COM_IMAGEM.includes(e.genero);
  // cortes do genero escolhido (mais os unissex)
  const estilos = useMemo(() => estilosDeCabelo(e.genero), [e.genero]);
  const passo = PASSOS[i];
  const ultimo = i === PASSOS.length - 1;

  function set<K extends keyof EscolhasAvatar>(campo: K, valor: EscolhasAvatar[K]) {
    setE((prev) => {
      const novo = { ...prev, [campo]: valor };
      // corte de cabelo e do genero: trocar de genero pode invalidar o escolhido
      if (campo === "genero") {
        const permitidos = estilosDeCabelo(String(valor));
        if (!permitidos.some((c) => c.chave === novo.cabeloEstilo)) {
          novo.cabeloEstilo = permitidos[0]?.chave;
        }
        if (valor === "male") novo.maquiagem = "sem";
      }
      return novo;
    });
  }

  const podeAvancar = useMemo(() => {
    if (passo.chave === "identidade") return e.nome.trim().length >= 2 && e.idade >= 18;
    return true;
  }, [passo.chave, e.nome, e.idade]);

  async function gerar() {
    setEnviando(true);
    try {
      localStorage.setItem(CHAVE_CRIANDO, String(Date.now()));
    } catch {
      // sem storage: segue sem a marca
    }
    try {
      const r = await fetch("/api/avatar/criar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(e),
      });
      const d = (await r.json().catch(() => ({}))) as {
        erro?: string;
        faltaCreditos?: boolean;
        avatar?: AvatarCriado;
      };
      if (!r.ok) {
        toast.error(
          d.faltaCreditos
            ? `Você precisa de ${CUSTO_AVATAR} créditos pra criar um influenciador.`
            : (d.erro ?? "Não consegui criar agora. Tente de novo."),
        );
        return;
      }
      if (d.avatar) {
        setCriado(d.avatar);
        onCriado?.(d.avatar);
        toast.success("Influenciador criado!");
      }
    } catch {
      toast.error("Sem conexão. Tente de novo.");
    } finally {
      setEnviando(false);
      try {
        localStorage.removeItem(CHAVE_CRIANDO);
      } catch {
        // sem storage: a marca expira sozinha em 8 min
      }
    }
  }

  // ===== resultado =====
  if (criado) {
    return (
      <div className="mx-auto w-full max-w-md space-y-4 text-center">
        <div className="overflow-hidden rounded-2xl border border-primary/60 shadow-[0_0_50px_-14px_var(--color-primary)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={criado.imagemUrl} alt={criado.nome} className="w-full object-cover" />
        </div>
        <div>
          <p className="font-semibold">{criado.nome} está pronto!</p>
          <p className="text-sm text-muted-foreground">
            Ele já aparece na sua lista e na hora de gerar os vídeos.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={onSair}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Check className="size-4" />
            Ver meus influenciadores
          </button>
          <a
            href={linkBaixar(criado.imagemUrl, `${criado.nome}.png`)}
            className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            <Download className="size-4" />
            Baixar
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* a pessoa saiu no meio de uma criação e voltou: avisa ANTES dela pagar de novo */}
      {avisoCriando && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-400/40 bg-amber-400/10 p-4">
          <Loader2 className="mt-0.5 size-4.5 shrink-0 animate-spin text-amber-300" />
          <div className="text-sm">
            <p className="font-semibold text-amber-300">
              Você já tem um influenciador sendo criado
            </p>
            <p className="mt-0.5 text-muted-foreground">
              Ele aparece sozinho na sua lista em 1 a 3 minutos. Criar outro agora
              cobra de novo — vale esperar ele chegar primeiro.
            </p>
          </div>
        </div>
      )}

      <Trilha atual={i} onIr={setI} />

      <div className="duration-300 animate-in fade-in slide-in-from-bottom-2" key={passo.chave}>
        {passo.chave === "identidade" && (
          <Caixa Icone={UserRound} titulo="Identidade do influenciador">
            <Campo rotulo="Nome do influenciador *">
              <input
                value={e.nome}
                onChange={(ev) => set("nome", ev.target.value.slice(0, 40))}
                placeholder="Ex: Marina"
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-primary/60"
              />
            </Campo>
            <div className="grid gap-5 sm:grid-cols-2">
              <Campo rotulo="Idade * (18 a 75)">
                <input
                  type="text"
                  inputMode="numeric"
                  value={idadeTxt}
                  onChange={(ev) => {
                    const so = ev.target.value.replace(/\D/g, "").slice(0, 2);
                    setIdadeTxt(so);
                    const n = Number(so);
                    if (n >= 18 && n <= 75) set("idade", n);
                  }}
                  onBlur={() => {
                    const n = Math.max(18, Math.min(75, Number(idadeTxt) || INICIAL.idade));
                    setIdadeTxt(String(n));
                    set("idade", n);
                  }}
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-primary/60"
                />
              </Campo>
              <Campo rotulo="Gênero">
                <Opcoes
                  opcoes={GENEROS}
                  valor={e.genero}
                  onEscolher={(v) => set("genero", v)}
                  colunas="sm:grid-cols-2"
                />
              </Campo>
            </div>
          </Caixa>
        )}

        {passo.chave === "pele" && (
          <Caixa Icone={Palette} titulo="Tom de pele">
            <p className="-mt-2 text-sm text-muted-foreground">
              Escolha o tom de pele do seu influenciador.
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
              {TONS_PELE.map((t) => {
                const ativo = e.tomPele === t.chave;
                return (
                  <button
                    key={t.chave}
                    type="button"
                    onClick={() => set("tomPele", t.chave)}
                    aria-pressed={ativo}
                    className={cn(
                      "overflow-hidden rounded-2xl border p-2 transition-all",
                      ativo
                        ? "border-primary ring-2 ring-primary/30 shadow-[0_0_24px_-8px_var(--color-primary)]"
                        : "border-border/60 hover:border-primary/40",
                    )}
                  >
                    {/* a amostra em CSS fica atrás: se a foto de pele demorar ou
                        faltar, o card continua mostrando o tom certo */}
                    <span
                      className="block aspect-square w-full overflow-hidden rounded-lg"
                      style={{ background: t.amostra }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={midiaPele(t.chave)}
                        alt={t.label}
                        loading="lazy"
                        className="size-full object-cover"
                        onError={(ev) => {
                          ev.currentTarget.style.display = "none";
                        }}
                      />
                    </span>
                    <span
                      className={cn(
                        "mt-2 block pb-0.5 text-center text-xs font-medium sm:text-[13px]",
                        ativo ? "text-primary" : "text-muted-foreground",
                      )}
                    >
                      {t.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </Caixa>
        )}

        {passo.chave === "fisico" && (
          <Caixa Icone={Dumbbell} titulo="Tipo físico">
            <p className="-mt-2 text-sm text-muted-foreground">
              Escolha o tipo de corpo do seu influenciador ({female ? "feminino" : "masculino"}).
            </p>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {TIPOS_FISICOS.map((t) => {
                const ativo = e.tipoFisico === t.chave;
                const g = tipoFisicoNoGenero(t, e.genero);
                return (
                  <button
                    key={t.chave}
                    type="button"
                    onClick={() => set("tipoFisico", t.chave)}
                    aria-pressed={ativo}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-2xl border p-3 transition-all sm:p-4",
                      ativo
                        ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                        : "border-border/60 hover:border-primary/40 hover:bg-card",
                    )}
                  >
                    {temManequim && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={midiaCorpo(e.genero, t.chave)}
                        alt={g.label}
                        loading="lazy"
                        className="h-40 rounded-lg object-contain sm:h-52 lg:h-60"
                        onError={(ev) => {
                          ev.currentTarget.style.display = "none";
                        }}
                      />
                    )}
                    <span className={cn("mt-1 text-sm font-semibold sm:text-base", ativo && "text-primary")}>
                      {g.label}
                    </span>
                    <span className="text-center text-[11px] text-muted-foreground sm:text-xs">
                      {g.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </Caixa>
        )}

        {passo.chave === "cabeloCor" && (
          <Caixa Icone={Palette} titulo="Cor do cabelo">
            <p className="-mt-2 text-sm text-muted-foreground">
              Escolha a cor do cabelo do seu influenciador.
            </p>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-6 lg:grid-cols-11">
              {CABELO_CORES.map((c) => {
                const ativo = e.cabeloCor === c.chave;
                return (
                  <button
                    key={c.chave}
                    type="button"
                    onClick={() => set("cabeloCor", c.chave)}
                    aria-pressed={ativo}
                    className={cn(
                      "overflow-hidden rounded-2xl border p-2 transition-all",
                      ativo
                        ? "border-primary shadow-[0_0_24px_-8px_var(--color-primary)] ring-2 ring-primary/30"
                        : "border-border/60 hover:border-primary/40",
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={midiaCabeloCor(c.chave)}
                      alt={c.label}
                      loading="lazy"
                      className="aspect-square w-full rounded-xl object-cover"
                    />
                    <span
                      className={cn(
                        "mt-2 block text-center text-xs font-medium",
                        ativo ? "text-primary" : "text-muted-foreground",
                      )}
                    >
                      {c.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </Caixa>
        )}

        {passo.chave === "cabeloEstilo" && (
          <Caixa Icone={Scissors} titulo="Estilo do cabelo">
            <p className="-mt-2 text-sm text-muted-foreground">
              Escolha o corte do seu influenciador ({female ? "feminino" : "masculino"} e unissex).
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
              {estilos.map((c) => {
                const ativo = e.cabeloEstilo === c.chave;
                return (
                  <button
                    key={c.chave}
                    type="button"
                    onClick={() => set("cabeloEstilo", c.chave)}
                    aria-pressed={ativo}
                    className={cn(
                      "overflow-hidden rounded-2xl border p-2 transition-all",
                      ativo
                        ? "border-primary shadow-[0_0_24px_-8px_var(--color-primary)] ring-2 ring-primary/30"
                        : "border-border/60 hover:border-primary/40",
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={midiaCabeloEstilo(c.genero, c.chave)}
                      alt={c.label}
                      loading="lazy"
                      className="aspect-square w-full rounded-xl bg-black/20 object-cover"
                    />
                    <span
                      className={cn(
                        "mt-2 block text-center text-xs font-medium",
                        ativo ? "text-primary" : "text-muted-foreground",
                      )}
                    >
                      {c.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </Caixa>
        )}

        {passo.chave === "detalhes" && (
          <Caixa Icone={Wand2} titulo="Detalhes">
            <Chave
              rotulo="Barba"
              descricao="Barba curta e bem cuidada"
              ligado={!!e.barba}
              onMudar={(v) => set("barba", v)}
            />
            <Chave
              rotulo="Óculos"
              descricao="Óculos de grau simples, armação fina"
              ligado={!!e.oculos}
              onMudar={(v) => set("oculos", v)}
            />
            <Campo rotulo="Traços adicionais">
              <textarea
                value={e.marcas}
                onChange={(ev) => set("marcas", ev.target.value.slice(0, 200))}
                rows={3}
                placeholder="Ex: sardas, tatuagem no braço, piercing no nariz..."
                className="w-full resize-y rounded-xl border border-border bg-background p-3 text-sm outline-none transition-colors focus:border-primary/60"
              />
              <p className="text-xs text-muted-foreground">
                Detalhe pequeno faz o rosto parecer de gente de verdade, e ajuda a IA a
                repetir a mesma pessoa depois.
              </p>
            </Campo>
          </Caixa>
        )}

        {passo.chave === "camisa" && (
          <Caixa Icone={Shirt} titulo="Camisa">
            <Campo rotulo="Tipo de camiseta">
              <div className="grid gap-2.5 sm:grid-cols-2">
                {CAMISA_TIPOS.map((t) => {
                  const ativo = (e.camisaTipo ?? "basica") === t.chave;
                  return (
                    <button
                      key={t.chave}
                      type="button"
                      onClick={() => set("camisaTipo", t.chave)}
                      aria-pressed={ativo}
                      className={cn(
                        "rounded-xl border px-3 py-3 text-center transition-all",
                        ativo
                          ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                          : "border-border/60 hover:border-primary/40 hover:bg-card",
                      )}
                    >
                      <span className={cn("block text-sm font-semibold", ativo && "text-primary")}>
                        {t.label}
                      </span>
                      <span className="text-[11px] text-muted-foreground">{t.desc}</span>
                    </button>
                  );
                })}
              </div>
            </Campo>

            <Campo rotulo="Cor da camiseta">
              <div className="flex flex-wrap gap-2.5">
                {CAMISAS.map((c) => {
                  const ativo = (e.camisa ?? "preta") === c.chave;
                  return (
                    <button
                      key={c.chave}
                      type="button"
                      onClick={() => set("camisa", c.chave)}
                      aria-pressed={ativo}
                      title={c.label}
                      className={cn(
                        "flex w-16 flex-col items-center gap-1 rounded-xl border p-1.5 transition-all sm:w-20",
                        ativo
                          ? "border-primary ring-2 ring-primary/30"
                          : "border-border/60 hover:border-primary/40",
                      )}
                    >
                      <span
                        className="size-10 rounded-full border border-white/10 shadow-inner sm:size-12"
                        style={{ background: c.cor }}
                      />
                      <span
                        className={cn(
                          "text-center text-[10px] leading-tight",
                          ativo ? "text-primary" : "text-muted-foreground",
                        )}
                      >
                        {c.label}
                      </span>
                    </button>
                  );
                })}

                {/* cor livre: a bolinha e o proprio seletor de cor */}
                <label
                  className={cn(
                    "flex w-16 cursor-pointer flex-col items-center gap-1 rounded-xl border p-1.5 transition-all sm:w-20",
                    e.camisa === "custom"
                      ? "border-primary ring-2 ring-primary/30"
                      : "border-border/60 hover:border-primary/40",
                  )}
                >
                  <span
                    className="size-10 rounded-full border border-white/10 sm:size-12"
                    style={{
                      background:
                        e.camisa === "custom" && e.camisaCor
                          ? e.camisaCor
                          : "conic-gradient(#f87171,#fbbf24,#4ade80,#22d3ee,#818cf8,#f472b6,#f87171)",
                    }}
                  />
                  <span
                    className={cn(
                      "text-center text-[10px] leading-tight",
                      e.camisa === "custom" ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    Outra cor
                  </span>
                  <input
                    type="color"
                    value={e.camisaCor ?? "#22c55e"}
                    onChange={(ev) => {
                      set("camisaCor", ev.target.value);
                      set("camisa", "custom");
                    }}
                    className="sr-only"
                  />
                </label>
              </div>
            </Campo>

          </Caixa>
        )}
      </div>

      {/* ===== NAVEGAÇÃO ===== */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => (i === 0 ? onSair() : setI(i - 1))}
          className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {i === 0 ? "Cancelar" : "Voltar"}
        </button>

        <div className="flex items-center gap-3">
          {ultimo && !admin && (
            <span className="text-xs text-muted-foreground">{CUSTO_AVATAR} créditos</span>
          )}
          <button
            type="button"
            disabled={!podeAvancar || enviando}
            onClick={() => (ultimo ? gerar() : setI(i + 1))}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 hover:shadow-[0_0_24px_-6px_var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {enviando ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Criando...
              </>
            ) : ultimo ? (
              <>
                <Sparkles className="size-4" />
                Criar influenciador
              </>
            ) : (
              <>
                Próximo
                <ArrowRight className="size-4" />
              </>
            )}
          </button>
        </div>

        {/* espera longa (1-3 min): deixa claro que não precisa ficar vigiando */}
        {enviando && (
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Leva de 1 a 3 minutos. Pode continuar navegando: ele aparece em
            &quot;Meus influenciadores&quot; assim que ficar pronto.
          </p>
        )}
      </div>
    </div>
  );
}
