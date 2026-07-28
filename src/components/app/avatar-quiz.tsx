"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Sparkles,
  Wand2,
  Pencil,
  Copy,
  ClipboardCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  GENEROS,
  IDADES,
  TONS_PELE,
  OLHOS,
  CABELO_CORES,
  CABELO_COMPRIMENTOS,
  CABELO_TEXTURAS,
  TIPOS_FISICOS,
  EXPRESSOES,
  MAQUIAGENS,
  CENARIOS,
  ESTILOS,
  CUSTO_AVATAR,
  type Opcao,
  type EscolhasAvatar,
} from "@/lib/avatar-modelo";

export type AvatarCriado = {
  id: string;
  nome: string;
  genero: string;
  imagemUrl: string;
  criadoEm: string;
};

const INICIAL: EscolhasAvatar = {
  nome: "",
  genero: "female",
  idade: 26,
  tomPele: "",
  formatoRosto: "oval", // fixo (a etapa saiu do quiz); o servidor usa esse padrão
  olhos: "",
  cabeloCor: "",
  cabeloComprimento: "",
  cabeloTextura: "",
  tipoFisico: "",
  expressao: "",
  maquiagem: "",
  marcas: "",
  cenario: "",
  estilo: "natural",
};

type Tela = {
  id: string;
  titulo: string;
  sub?: string;
  tipo: "texto" | "opcao" | "idade" | "cabelo" | "cenario" | "revisar";
  campo?: keyof EscolhasAvatar;
  opcoes?: Opcao[];
  ph?: string;
  opcional?: boolean;
  soFemale?: boolean;
};

const TELAS: Tela[] = [
  { id: "nome", tipo: "texto", campo: "nome", titulo: "Qual o nome do avatar?", sub: "É só pra você identificar depois.", ph: "Ex: Marina" },
  { id: "genero", tipo: "opcao", campo: "genero", titulo: "Gênero", opcoes: GENEROS },
  { id: "idade", tipo: "idade", titulo: "Idade aparente" },
  { id: "tomPele", tipo: "opcao", campo: "tomPele", titulo: "Tom de pele", opcoes: TONS_PELE },
  { id: "olhos", tipo: "opcao", campo: "olhos", titulo: "Cor dos olhos", opcoes: OLHOS },
  { id: "cabelo", tipo: "cabelo", titulo: "Cabelo", sub: "Cor, comprimento e textura." },
  { id: "tipoFisico", tipo: "opcao", campo: "tipoFisico", titulo: "Tipo físico", opcoes: TIPOS_FISICOS },
  { id: "expressao", tipo: "opcao", campo: "expressao", titulo: "Expressão", opcoes: EXPRESSOES },
  { id: "maquiagem", tipo: "opcao", campo: "maquiagem", titulo: "Maquiagem", opcoes: MAQUIAGENS, soFemale: true },
  { id: "marcas", tipo: "texto", campo: "marcas", titulo: "Marcas registradas", sub: "Opcional. Dá personalidade e realismo.", ph: "Ex: sardas no rosto, uma pinta no queixo", opcional: true },
  { id: "cenario", tipo: "cenario", titulo: "Cenário", sub: "Onde a foto acontece." },
  { id: "estilo", tipo: "opcao", campo: "estilo", titulo: "Estilo do resultado", opcoes: ESTILOS },
  { id: "revisar", tipo: "revisar", titulo: "Revisar e gerar", sub: "Confira tudo e toque no lápis pra ajustar." },
];

function labelDe(lista: { chave: string; label: string }[], chave: string) {
  return lista.find((o) => o.chave === chave)?.label ?? "-";
}

export function AvatarQuiz({
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
  const [feito, setFeito] = useState(false);
  // avatar gerado (foto pronta, hospedada no serverrk)
  const [criado, setCriado] = useState<AvatarCriado | null>(null);
  // prompt final (JSON) devolvido pro admin, pra ver/copiar e gerar a imagem
  const [jsonFinal, setJsonFinal] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  // quando a pessoa vem da revisão pelo lápis, ao escolher ela volta pra revisão
  const [editando, setEditando] = useState(false);

  // esconde a etapa de maquiagem quando for homem
  const telas = useMemo(
    () => TELAS.filter((t) => !(t.soFemale && e.genero === "male")),
    [e.genero],
  );
  const idxRevisar = telas.length - 1;
  const tela = telas[Math.min(i, idxRevisar)];
  const total = telas.length;

  function set<K extends keyof EscolhasAvatar>(campo: K, valor: EscolhasAvatar[K]) {
    setE((prev) => ({ ...prev, [campo]: valor }));
  }

  function proximo() {
    if (editando) {
      setEditando(false);
      setI(idxRevisar);
      return;
    }
    setI((v) => Math.min(v + 1, idxRevisar));
  }
  function voltar() {
    setEditando(false);
    if (i === 0) {
      onSair();
      return;
    }
    setI((v) => Math.max(v - 1, 0));
  }
  function irParaEtapa(id: string) {
    const idx = telas.findIndex((t) => t.id === id);
    if (idx >= 0) {
      setEditando(true);
      setI(idx);
    }
  }

  // escolher numa etapa de 1 opção já avança sozinho (sensação de quiz)
  function escolherEavancar<K extends keyof EscolhasAvatar>(campo: K, valor: EscolhasAvatar[K]) {
    set(campo, valor);
    setTimeout(proximo, 160);
  }

  function podeAvancar(): boolean {
    switch (tela.tipo) {
      case "texto":
        return tela.opcional ? true : String(e[tela.campo!]).trim().length >= 2;
      case "cabelo":
        return !!e.cabeloCor && !!e.cabeloComprimento && !!e.cabeloTextura;
      case "cenario":
        return !!e.cenario;
      case "opcao":
        return !!e[tela.campo!];
      default:
        return true;
    }
  }

  async function gerar() {
    setEnviando(true);
    try {
      const r = await fetch("/api/avatar/criar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(e),
      });
      const data = (await r.json().catch(() => ({}))) as {
        erro?: string;
        faltaCreditos?: boolean;
        json?: unknown;
        avatar?: AvatarCriado;
      };
      if (!r.ok) {
        toast.error(
          data.faltaCreditos
            ? `Você precisa de ${CUSTO_AVATAR} créditos pra gerar um avatar.`
            : data.erro ?? "Não consegui gerar o avatar. Tente de novo.",
        );
        return;
      }
      if (data.json) setJsonFinal(JSON.stringify(data.json, null, 2));
      if (data.avatar) {
        setCriado(data.avatar);
        onCriado?.(data.avatar);
      }
      setFeito(true);
    } catch {
      toast.error("Sem conexão. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  // ===== tela final de sucesso =====
  if (feito) {
    return (
      <div className="mx-auto flex min-h-[calc(100dvh-8rem)] w-full max-w-md flex-col items-center justify-center">
        <div className="flex w-full flex-col items-center gap-3 rounded-3xl border border-border bg-card p-8 text-center shadow-sm">
          <span className="relative grid size-16 place-items-center">
            <span className="absolute inset-0 animate-ping rounded-full bg-primary/25" />
            <span className="relative grid size-14 place-items-center rounded-full bg-primary text-primary-foreground">
              <Check className="size-7" strokeWidth={3} />
            </span>
          </span>
          <h2 className="text-lg font-bold">Avatar &quot;{e.nome}&quot; pronto! ✨</h2>

          {/* foto gerada */}
          {criado?.imagemUrl && (
            <div className="w-full overflow-hidden rounded-2xl border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={criado.imagemUrl}
                alt={criado.nome}
                className="aspect-[3/4] w-full object-cover"
              />
            </div>
          )}

          <p className="text-sm text-muted-foreground">
            {criado
              ? "Seu avatar já está salvo. Use ele nos vídeos de produto."
              : "Guardamos as escolhas do seu avatar."}
          </p>
          <button
            type="button"
            onClick={onSair}
            className="mt-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Voltar aos meus avatares
          </button>
        </div>

        {/* prompt final (só admin): ver e copiar pra gerar a imagem manualmente */}
        {jsonFinal && (
          <div className="mt-4 w-full overflow-hidden rounded-2xl border border-border bg-card">
            <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Prompt final (JSON) · admin
              </p>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(jsonFinal).then(() => {
                    setCopiado(true);
                    toast.success("Prompt copiado!");
                    setTimeout(() => setCopiado(false), 2000);
                  });
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold transition-colors hover:border-primary/50 hover:text-primary"
              >
                {copiado ? <ClipboardCheck className="size-3.5" /> : <Copy className="size-3.5" />}
                {copiado ? "Copiado" : "Copiar"}
              </button>
            </div>
            <pre className="max-h-80 overflow-auto p-4 text-left text-[11px] leading-relaxed text-muted-foreground">
              {jsonFinal}
            </pre>
          </div>
        )}
      </div>
    );
  }

  // ===== tela de "gerando" (a foto leva ate ~1 min no gpt-image-1) =====
  if (enviando) {
    return (
      <div className="mx-auto flex min-h-[calc(100dvh-8rem)] w-full max-w-md flex-col items-center justify-center">
        <div className="flex w-full flex-col items-center gap-3 rounded-3xl border border-border bg-card p-8 text-center shadow-sm">
          <span className="relative grid size-16 place-items-center">
            <span
              className="absolute inset-0 animate-spin rounded-full"
              style={{
                background:
                  "conic-gradient(from 0deg, transparent 15%, rgb(16 185 129), transparent 85%)",
                animationDuration: "2.4s",
              }}
            />
            <span className="relative grid size-[52px] place-items-center rounded-full bg-card">
              <Wand2 className="size-6 text-primary" />
            </span>
          </span>
          <h2 className="text-lg font-bold">Gerando &quot;{e.nome}&quot;...</h2>
          <p className="text-sm text-muted-foreground">
            A IA está criando a foto do seu avatar. Isso leva alguns segundos, pode
            deixar essa tela aberta. ✨
          </p>
        </div>
      </div>
    );
  }

  const pct = Math.round(((i + 1) / total) * 100);
  const ehRevisar = tela.tipo === "revisar";

  // linhas do resumo (cada uma editável pelo lápis)
  const resumo: { id: string; rot: string; val: string }[] = [
    { id: "nome", rot: "Nome", val: e.nome || "-" },
    { id: "genero", rot: "Gênero", val: labelDe(GENEROS, e.genero) },
    { id: "idade", rot: "Idade", val: `${e.idade} anos` },
    { id: "tomPele", rot: "Tom de pele", val: labelDe(TONS_PELE, e.tomPele) },
    { id: "olhos", rot: "Olhos", val: labelDe(OLHOS, e.olhos) },
    {
      id: "cabelo",
      rot: "Cabelo",
      val: `${labelDe(CABELO_CORES, e.cabeloCor)}, ${labelDe(CABELO_COMPRIMENTOS, e.cabeloComprimento)}, ${labelDe(CABELO_TEXTURAS, e.cabeloTextura)}`,
    },
    { id: "tipoFisico", rot: "Tipo físico", val: labelDe(TIPOS_FISICOS, e.tipoFisico) },
    { id: "expressao", rot: "Expressão", val: labelDe(EXPRESSOES, e.expressao) },
    ...(e.genero === "female"
      ? [{ id: "maquiagem", rot: "Maquiagem", val: labelDe(MAQUIAGENS, e.maquiagem) }]
      : []),
    ...(e.marcas.trim() ? [{ id: "marcas", rot: "Marcas", val: e.marcas.trim() }] : []),
    { id: "cenario", rot: "Cenário", val: labelDe(CENARIOS, e.cenario) },
    { id: "estilo", rot: "Estilo", val: labelDe(ESTILOS, e.estilo) },
  ];

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-8rem)] w-full max-w-xl flex-col justify-center py-4">
      {/* cabeçalho: "Criando seu avatar" com anel verde girando */}
      <div className="mb-5 flex flex-col items-center gap-2.5 text-center">
        <span className="relative grid size-14 place-items-center">
          <span
            className="absolute inset-0 animate-spin rounded-full"
            style={{
              background:
                "conic-gradient(from 0deg, transparent 15%, rgb(16 185 129), transparent 85%)",
              animationDuration: "2.4s",
            }}
          />
          <span className="relative grid size-11 place-items-center rounded-full bg-card">
            <Wand2 className="size-5 text-primary" />
          </span>
        </span>
        <div>
          <p className="text-base font-bold tracking-tight">Criando seu avatar</p>
          <p className="text-xs text-muted-foreground">
            Passo {i + 1} de {total}
          </p>
        </div>
      </div>

      {/* progresso */}
      <div className="mb-4">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-400 transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <h2 className="text-xl font-bold tracking-tight">{tela.titulo}</h2>
        {tela.sub && <p className="mt-1 text-sm text-muted-foreground">{tela.sub}</p>}

        <div className="mt-5">
          {/* ---- texto ---- */}
          {tela.tipo === "texto" && (
            <input
              autoFocus
              value={String(e[tela.campo!])}
              onChange={(ev) => set(tela.campo!, ev.target.value)}
              onKeyDown={(ev) => ev.key === "Enter" && podeAvancar() && proximo()}
              placeholder={tela.ph}
              className="w-full rounded-xl border border-border bg-background px-3.5 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          )}

          {/* ---- idade ---- */}
          {tela.tipo === "idade" && (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
              {IDADES.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => escolherEavancar("idade", n)}
                  className={cn(
                    "rounded-xl border py-3 text-sm font-semibold transition-all",
                    e.idade === n
                      ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/30"
                      : "border-border hover:border-primary/50",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          )}

          {/* ---- opção simples ---- */}
          {tela.tipo === "opcao" && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {tela.opcoes!.map((o) => (
                <OpcaoBtn
                  key={o.chave}
                  label={o.label}
                  ativo={e[tela.campo!] === o.chave}
                  onClick={() => escolherEavancar(tela.campo!, o.chave)}
                />
              ))}
            </div>
          )}

          {/* ---- cabelo (3 grupos) ---- */}
          {tela.tipo === "cabelo" && (
            <div className="space-y-4">
              <GrupoOpcoes titulo="Cor" opcoes={CABELO_CORES} valor={e.cabeloCor} onEscolher={(c) => set("cabeloCor", c)} />
              <GrupoOpcoes titulo="Comprimento" opcoes={CABELO_COMPRIMENTOS} valor={e.cabeloComprimento} onEscolher={(c) => set("cabeloComprimento", c)} />
              <GrupoOpcoes titulo="Textura" opcoes={CABELO_TEXTURAS} valor={e.cabeloTextura} onEscolher={(c) => set("cabeloTextura", c)} />
            </div>
          )}

          {/* ---- cenário ---- */}
          {tela.tipo === "cenario" && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {CENARIOS.map((c) => (
                <OpcaoBtn
                  key={c.chave}
                  label={c.label}
                  ativo={e.cenario === c.chave}
                  onClick={() => escolherEavancar("cenario", c.chave)}
                />
              ))}
            </div>
          )}

          {/* ---- revisar ---- */}
          {ehRevisar && (
            <div className="overflow-hidden rounded-2xl border border-border">
              {resumo.map((l) => (
                <div
                  key={l.id}
                  className="group flex items-center justify-between gap-3 border-b border-border/60 px-4 py-2.5 transition-colors last:border-0 hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      {l.rot}
                    </p>
                    <p className="truncate text-sm font-semibold">{l.val}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => irParaEtapa(l.id)}
                    aria-label={`Editar ${l.rot}`}
                    className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                  >
                    <Pencil className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* custo (ou aviso "em breve" pra quem não é admin) */}
          {ehRevisar && (
            <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-3">
              <Sparkles className="size-4 shrink-0 text-amber-500" />
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Gerar esse avatar usa{" "}
                <span className="font-bold">{CUSTO_AVATAR} créditos</span>. A foto fica
                salva pra usar em quantos vídeos quiser.
              </p>
            </div>
          )}
        </div>

        {/* navegação */}
        <div className="mt-6 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={voltar}
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            {i === 0 ? "Sair" : "Voltar"}
          </button>

          {ehRevisar ? (
            <button
              type="button"
              onClick={gerar}
              disabled={enviando}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/25 transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              {enviando ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              Gerar avatar
            </button>
          ) : (
            <button
              type="button"
              onClick={proximo}
              disabled={!podeAvancar()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {editando ? "Salvar" : "Avançar"}
              <ArrowRight className="size-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function OpcaoBtn({ label, ativo, onClick }: { label: string; ativo: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center justify-between gap-2 rounded-xl border px-3.5 py-3 text-left text-sm font-medium transition-all",
        ativo
          ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/30"
          : "border-border hover:border-primary/50 hover:bg-muted/40",
      )}
    >
      {label}
      {ativo && <Check className="size-4 shrink-0" strokeWidth={3} />}
    </button>
  );
}

function GrupoOpcoes({
  titulo,
  opcoes,
  valor,
  onEscolher,
}: {
  titulo: string;
  opcoes: Opcao[];
  valor: string;
  onEscolher: (chave: string) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {titulo}
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {opcoes.map((o) => (
          <OpcaoBtn key={o.chave} label={o.label} ativo={valor === o.chave} onClick={() => onEscolher(o.chave)} />
        ))}
      </div>
    </div>
  );
}
