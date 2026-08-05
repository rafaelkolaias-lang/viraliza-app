"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  CheckCheck,
  // balãozinho com reticências: lê como "bate-papo" na hora. Diferente do
  // `MessageCircle` liso do chat com a equipe, pra não confundir os dois botões
  MessageCircleMore,
  MessagesSquare,
  Plus,
  Send,
  Sparkles,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { guardarSom, somEnviar, somLigado, somReceber } from "@/lib/suporte-som";
import { respostasProntas } from "@/lib/suporte-prontas";
import {
  carregarConversas,
  conversaNova,
  partirResposta,
  quandoFoi,
  salvarConversas,
  tituloDaConversa,
  type Conversa,
  type Entrega,
  type LinkTela,
  type Msg,
} from "@/lib/suporte-conversas";

/**
 * Suporte flutuante do painel (canto de baixo, à direita).
 *
 * Responde com o conteúdo da Central de Ajuda e aponta a tela certa. Roda no
 * nosso próprio LLM (ver `api/suporte/chat`), então NÃO desconta crédito.
 *
 * A conversa imita o WhatsApp de propósito: "Online" no cabeçalho, vistinho de
 * enviado/entregue/lido e três pontinhos antes da resposta. Robô que responde
 * instantâneo e escreve "processando" assusta e parece máquina; assim a espera
 * de alguns segundos vira uma conversa normal. Nada disso engana sobre o que é:
 * a saudação já diz que é o suporte da plataforma.
 *
 * O histórico fica no navegador e vale 24h (ver `lib/suporte-conversas.ts`), com
 * várias conversas separadas. As conversas só são LIDAS quando a pessoa abre o
 * widget, nunca durante a renderização: ler localStorage no meio da pintura
 * daria diferença entre servidor e navegador.
 *
 * Fica ao lado da caixinha do admin (`chat-widget.tsx`), que sobe pra não cobrir
 * este botão quando existe conversa aberta.
 */

/**
 * Quanto o "atendente" leva pra responder uma pergunta sugerida.
 *
 * Resposta pronta sai na hora, e chegar em 1 segundo entregaria que é automático.
 * Então a gente segura ~10s no total (descontando o tempo dos vistinhos), que é
 * o tempo de alguém ler e começar a escrever.
 */
const ESPERA_PRONTA = 10_000 - 400 - 600;

/** Ritmo da conversa (ms). Curto o bastante pra não irritar quem tem pressa. */
const ATE_ENTREGAR = 400;
const ATE_LER = 600;
/**
 * Quanto tempo os três pontinhos ficam na tela antes de cada balão.
 *
 * É o tempo de "escrever" a mensagem, então acompanha o tamanho dela. Pessoa de
 * verdade levaria uns 20s pra digitar 150 caracteres, o que aqui seria uma
 * eternidade; 1,6s a 4,5s é o ponto em que parece gente sem virar espera chata.
 * Balões seguintes vêm um pouco mais rápido, porque a pessoa já está lendo o
 * anterior.
 */
const DIGITANDO_MIN = 1600;
const DIGITANDO_MAX = 4500;
const SEGUINTE_MIN = 1200;
const SEGUINTE_MAX = 3500;
const POR_LETRA = 22;

function pausaDigitando(indice: number, tamanho: number): number {
  return indice === 0
    ? Math.min(DIGITANDO_MAX, DIGITANDO_MIN + tamanho * POR_LETRA)
    : Math.min(SEGUINTE_MAX, SEGUINTE_MIN + tamanho * POR_LETRA);
}
/** revelação letra por letra: quanto tempo o balão inteiro leva pra sair */
const REVELAR_MIN = 400;
const REVELAR_MAX = 1600;
const PASSO_MS = 28;

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Pede pro servidor deixar o modelo carregado.
 *
 * O Ollama descarrega o modelo depois de ~5 min parado, então NÃO basta aquecer
 * ao abrir a caixa: quem deixa a conversa aberta e volta 10 minutos depois
 * pegaria os ~45s de carregamento na próxima pergunta. Por isso a gente aquece
 * de novo quando a pessoa clica no campo pra escrever. Chamar à toa é barato: o
 * servidor ignora pedidos repetidos dentro de 4 minutos.
 */
function aquecer() {
  fetch("/api/suporte/chat", { method: "GET", cache: "no-store" }).catch(() => {});
}

function agora(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * Vistinho da mensagem enviada.
 *
 * O "lido" NÃO é azul: no balão verde da plataforma o azul praticamente
 * desaparece. A diferença é feita pela opacidade (1 risco fraco, 2 riscos
 * fracos, 2 riscos cheios), que aparece bem sobre o verde.
 */
function Vistinho({ entrega }: { entrega: Entrega }) {
  if (entrega === "enviando") return <Check className="size-3.5 opacity-50" />;
  return <CheckCheck className={entrega === "lido" ? "size-3.5" : "size-3.5 opacity-50"} />;
}

function Digitando() {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm border border-border bg-background px-3.5 py-3">
        {[0, 150, 300].map((atraso) => (
          <span
            key={atraso}
            className="size-1.5 animate-bounce rounded-full bg-muted-foreground/70"
            style={{ animationDelay: `${atraso}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

export function SuporteChat({ garantiaDias }: { garantiaDias: number }) {
  const prontas = respostasProntas(garantiaDias);
  const [aberto, setAberto] = useState(false);
  const [vendoLista, setVendoLista] = useState(false);
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [atualId, setAtualId] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [digitando, setDigitando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [demorando, setDemorando] = useState(false);
  /** balão sendo revelado letra por letra. Fica FORA das conversas de propósito:
   *  gravar no localStorage a cada letra seria dezenas de escritas por resposta */
  const [parcial, setParcial] = useState<{ conversa: string; texto: string } | null>(null);
  const [comSom, setComSom] = useState(true);
  /** a resposta demora, e a pessoa pode desligar o som no meio dela */
  const somRef = useRef(true);
  const fimRef = useRef<HTMLDivElement>(null);
  const entradaRef = useRef<HTMLInputElement>(null);
  /** espelho das conversas pra calcular o próximo estado fora do React */
  const espelho = useRef<Conversa[]>([]);
  const proximoId = useRef(1);

  const atual = conversas.find((c) => c.id === atualId) ?? null;
  const mensagens = atual?.mensagens ?? [];

  useEffect(() => {
    if (aberto && !vendoLista) {
      // enquanto o texto sai letra por letra o scroll é SECO: rolagem suave
      // dispararia dezenas de vezes por segundo e ficaria tremida
      fimRef.current?.scrollIntoView({ behavior: parcial ? "auto" : "smooth", block: "end" });
    }
    // `atualId` entra na lista: trocando pra uma conversa com a MESMA quantidade
    // de mensagens, sem ele o efeito não rodava e a conversa abria no meio
  }, [mensagens.length, digitando, parcial, aberto, vendoLista, atualId]);

  // Ao ABRIR, avisa o servidor pra carregar o modelo. Ele mora na máquina do
  // dono e demora ~45s pra subir depois de um tempo parado; aquecendo enquanto
  // a pessoa digita, a primeira resposta chega rápido igual às outras.
  useEffect(() => {
    if (!aberto) return;
    aquecer();
  }, [aberto]);

  /** Grava e reflete de uma vez (evita efeito colateral dentro do setState). */
  function aplicar(proximas: Conversa[]) {
    espelho.current = proximas;
    setConversas(proximas);
    salvarConversas(proximas);
  }

  /** Mexe nas mensagens de UMA conversa específica (a resposta pode chegar
   *  depois da pessoa já ter trocado de conversa). */
  function mexerNa(id: string, muda: (msgs: Msg[]) => Msg[]) {
    aplicar(
      espelho.current.map((c) =>
        c.id === id ? { ...c, atualizadaEm: Date.now(), mensagens: muda(c.mensagens) } : c,
      ),
    );
  }

  function comecarNova() {
    const nova = conversaNova();
    aplicar([nova, ...espelho.current]);
    setAtualId(nova.id);
    setVendoLista(false);
    setTexto("");
    setTimeout(() => entradaRef.current?.focus(), 50);
  }

  function apagar(id: string) {
    const restantes = espelho.current.filter((c) => c.id !== id);
    aplicar(restantes);
    if (id !== atualId) return;
    // apagou a que estava aberta: cai na mais recente, ou começa uma nova
    if (restantes[0]) {
      setAtualId(restantes[0].id);
    } else {
      const nova = conversaNova();
      aplicar([nova]);
      setAtualId(nova.id);
    }
  }

  function alternarSom() {
    const proximo = !somRef.current;
    somRef.current = proximo;
    setComSom(proximo);
    guardarSom(proximo);
    if (proximo) somReceber(); // amostra do som que ela acabou de ligar
  }

  /**
   * Abre o widget carregando o histórico. É AQUI que o localStorage é lido (num
   * clique, nunca na renderização), e é aqui que as conversas velhas somem.
   */
  function abrirWidget() {
    const ligado = somLigado();
    somRef.current = ligado;
    setComSom(ligado);
    const guardadas = carregarConversas();
    // os ids das mensagens continuam de onde pararam pra não repetir key
    proximoId.current =
      guardadas.reduce((maior, c) => Math.max(maior, ...c.mensagens.map((m) => m.id)), 0) + 1;
    if (guardadas.length === 0) {
      const nova = conversaNova();
      aplicar([nova]);
      setAtualId(nova.id);
    } else {
      espelho.current = guardadas;
      setConversas(guardadas);
      setAtualId(guardadas[0].id);
    }
    setVendoLista(false);
    setAberto(true);

    /**
     * Pergunta que ficou sem resposta (a pessoa fechou a aba durante a espera)
     * é retomada sozinha ao voltar. Sem isso ela reabria o chat, via a própria
     * pergunta com um risco só e nada embaixo, e tinha que perguntar de novo.
     *
     * Não vira laço infinito: se a retomada falhar, o erro entra como mensagem
     * do robô, então a última mensagem deixa de ser dela.
     */
    const aberta = guardadas[0];
    const ultima = aberta?.mensagens[aberta.mensagens.length - 1];
    if (ultima?.autor === "user") {
      perguntar(ultima.texto, { conversa: aberta.id, retomar: true });
    }
  }

  /**
   * `retomar` é o caso de quem fechou a aba no meio da espera: a pergunta já
   * está guardada, então NÃO se cria outra mensagem nem toca o som de enviar;
   * só refazemos o pedido em cima da mensagem que ficou sem resposta.
   *
   * `conversa` existe porque a retomada acontece dentro do `abrirWidget`, antes
   * do React aplicar o `setAtualId`, e aí `atualId` ainda estaria desatualizado.
   */
  async function perguntar(
    pergunta: string,
    opcoes?: { conversa?: string; retomar?: boolean },
  ) {
    const limpa = pergunta.trim();
    const idConversa = opcoes?.conversa ?? atualId;
    if (!limpa || ocupado || !idConversa) return;

    let id: number;
    if (opcoes?.retomar) {
      const msgs = espelho.current.find((c) => c.id === idConversa)?.mensagens ?? [];
      const ultima = msgs[msgs.length - 1];
      if (!ultima || ultima.autor !== "user") return;
      id = ultima.id;
    } else {
      id = proximoId.current++;
      const minha: Msg = { id, autor: "user", texto: limpa, hora: agora(), entrega: "enviando" };
      mexerNa(idConversa, (msgs) => [...msgs, minha]);
      if (somRef.current) somEnviar();
    }

    /**
     * Histórico que vai pro modelo, pra ele entender "e o outro?", "não entendi"
     * e continuar de onde parou.
     *
     * Balões seguidos do robô são JUNTADOS numa fala só: como uma resposta vira
     * 2 ou 3 balões, mandar cada um como fala separada gastaria o limite de
     * mensagens do servidor em uma única resposta e a conversa "esqueceria" o
     * começo. Juntando, o limite passa a contar trocas de verdade.
     */
    const historico: { autor: "user" | "bot"; texto: string }[] = [];
    for (const m of espelho.current.find((c) => c.id === idConversa)?.mensagens ?? []) {
      const anterior = historico[historico.length - 1];
      if (anterior && anterior.autor === m.autor) anterior.texto += `\n\n${m.texto}`;
      else historico.push({ autor: m.autor, texto: m.texto });
    }

    setTexto("");
    setOcupado(true);

    // Pergunta sugerida tem resposta escrita à mão: não incomoda o modelo, não
    // corre risco de número errado e sai sempre igual.
    const pronta = prontas.find((p) => p.pergunta === limpa);

    // se passar disso, o modelo está subindo do zero: melhor explicar do que
    // deixar a pessoa achando que travou (não vale pras prontas, que já têm
    // tempo de resposta conhecido)
    const avisoLento = pronta ? null : setTimeout(() => setDemorando(true), 15_000);

    // o pedido sai JÁ: os vistinhos correm por cima da espera real, não somam
    const pedido = pronta
      ? null
      : fetch("/api/suporte/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mensagens: historico }),
        })
          .then((r) => r.json())
          .catch(() => ({ erro: "Sem conexão. Tente de novo em instantes." }));

    const marcar = (entrega: Entrega) =>
      mexerNa(idConversa, (msgs) => msgs.map((m) => (m.id === id ? { ...m, entrega } : m)));

    /**
     * O `finally` NÃO é enfeite: sem ele, qualquer erro no meio do caminho
     * deixaria `ocupado` preso em true, o campo de escrever desabilitado pra
     * sempre e a pessoa obrigada a recarregar a página pra voltar a falar.
     */
    try {
      await espera(ATE_ENTREGAR);
      marcar("entregue");
      await espera(ATE_LER);
      marcar("lido");

      // Repare que NÃO mostramos os pontinhos aqui. Enquanto o modelo pensa, a
      // conversa fica só com o "lido", que é o que acontece de verdade quando
      // alguém leu e ainda não começou a escrever. Os pontinhos são reservados
      // pro momento em que a resposta JÁ existe e vai começar a ser digitada.
      let resposta: string;
      let links: LinkTela[] | undefined;

      if (pronta) {
        resposta = pronta.resposta;
        links = pronta.links;
        // os ~10s contam ATÉ o texto começar a sair, e os pontinhos já fazem
        // parte dessa espera. Sem descontar, a pronta demoraria 14s pra aparecer.
        const primeiro = partirResposta(resposta)[0] ?? "";
        await espera(Math.max(0, ESPERA_PRONTA - pausaDigitando(0, primeiro.length)));
      } else {
        const d = (await pedido) as { texto?: string; links?: LinkTela[]; erro?: string };
        if (avisoLento) clearTimeout(avisoLento);
        setDemorando(false);
        resposta = d.texto ?? d.erro ?? "Não consegui responder agora. Tente de novo em instantes.";
        links = d.links;
      }

      /**
       * Botão de tela que JÁ apareceu nesta conversa não aparece de novo.
       *
       * O modelo insiste em repetir a mesma rota em toda resposta do assunto, e
       * a conversa virava uma coluna de botões "Créditos" idênticos. A regra no
       * prompt ajuda, mas ela depende do modelo obedecer; esta trava não.
       */
      const jaOferecidas = new Set(
        (espelho.current.find((c) => c.id === idConversa)?.mensagens ?? []).flatMap(
          (m) => m.links?.map((l) => l.rota) ?? [],
        ),
      );
      const novos = links?.filter((l) => !jaOferecidas.has(l.rota));

      // Resposta longa vira vários balões, um de cada vez: parede de texto de
      // uma vez só entrega que é robô e é mais difícil de ler. Cada balão tem os
      // pontinhos antes e depois aparece letra por letra. Os botões de tela
      // entram só no ÚLTIMO balão.
      const baloes = partirResposta(resposta);
      for (let i = 0; i < baloes.length; i++) {
        const balao = baloes[i];
        setDigitando(true);
        await espera(pausaDigitando(i, balao.length));
        setDigitando(false);
        if (somRef.current) somReceber();

        // sai letra por letra num tempo fixo, independente do tamanho: texto
        // grande revelado caractere a caractere ficaria lento demais pra ler
        const total = Math.min(REVELAR_MAX, Math.max(REVELAR_MIN, balao.length * 12));
        const porPasso = Math.max(1, Math.ceil(balao.length / (total / PASSO_MS)));
        for (let n = porPasso; n < balao.length; n += porPasso) {
          setParcial({ conversa: idConversa, texto: balao.slice(0, n) });
          await espera(PASSO_MS);
        }
        setParcial(null);

        mexerNa(idConversa, (msgs) => [
          ...msgs,
          {
            id: proximoId.current++,
            autor: "bot",
            texto: balao,
            links: i === baloes.length - 1 && novos?.length ? novos : undefined,
            hora: agora(),
          },
        ]);
      }
    } finally {
      if (avisoLento) clearTimeout(avisoLento);
      setDigitando(false);
      setParcial(null);
      setDemorando(false);
      setOcupado(false);
      entradaRef.current?.focus();
    }
  }

  return (
    <>
      {/* z acima dos botões: aberta, a caixa passa por cima da boia do chat da
          equipe em vez de ficar recortada por ele. O `max-h` manda em tela
          baixa: sem ele a caixa alta passaria por cima do cabeçalho do painel
          num notebook de tela pequena. */}
      {aberto && (
        <div className="fixed bottom-28 right-6 z-[60] flex h-[38rem] max-h-[calc(100vh-9rem)] w-[calc(100vw-3rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl sm:bottom-36 sm:right-20 sm:max-h-[calc(100vh-11rem)]">
          <div className="flex items-center gap-2.5 border-b border-border bg-primary/10 px-3.5 py-2.5">
            <span className="relative grid size-9 shrink-0 place-items-center rounded-full bg-primary/20 text-primary">
              <MessageCircleMore className="size-4.5" />
              <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-card bg-emerald-500" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold leading-tight">
                {vendoLista ? "Suas conversas" : "Suporte Viraliza"}
              </p>
              {/* sempre "Online": quem está escrevendo já é dito pelos pontinhos
                  no fim da conversa, escrever de novo aqui era repetição */}
              <p className="text-[11px] text-emerald-500">
                {vendoLista ? `${conversas.length} guardada(s)` : "Online"}
              </p>
            </div>

            <button
              type="button"
              onClick={alternarSom}
              aria-label={comSom ? "Desligar o som do chat" : "Ligar o som do chat"}
              title={comSom ? "Desligar o som" : "Ligar o som"}
              className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              {comSom ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
            </button>
            <button
              type="button"
              onClick={() => setVendoLista((v) => !v)}
              aria-label={vendoLista ? "Voltar pra conversa" : "Ver minhas conversas"}
              title={vendoLista ? "Voltar pra conversa" : "Ver minhas conversas"}
              className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <MessagesSquare className="size-4" />
            </button>
            <button
              type="button"
              onClick={comecarNova}
              aria-label="Começar nova conversa"
              title="Começar nova conversa"
              className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <Plus className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setAberto(false)}
              aria-label="Fechar conversa"
              className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>

          {vendoLista ? (
            <div className="flex-1 space-y-1.5 overflow-y-auto p-3">
              <button
                type="button"
                onClick={comecarNova}
                className="flex w-full items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/20"
              >
                <Plus className="size-4" />
                Começar nova conversa
              </button>

              {conversas.map((c) => (
                <div
                  key={c.id}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 transition-colors ${
                    c.id === atualId ? "border-primary/40 bg-primary/5" : "border-border"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setAtualId(c.id);
                      setVendoLista(false);
                    }}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="truncate text-sm">{tituloDaConversa(c)}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {quandoFoi(c.atualizadaEm)}
                    </p>
                  </button>
                  {/* apagar a conversa que está esperando resposta jogaria a
                      resposta fora sem avisar: o botão trava até ela chegar */}
                  <button
                    type="button"
                    onClick={() => apagar(c.id)}
                    disabled={ocupado && c.id === atualId}
                    aria-label="Apagar conversa"
                    className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-30"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}

              <p className="px-1 pt-2 text-[11px] leading-relaxed text-muted-foreground">
                As conversas ficam guardadas neste navegador por 24 horas e depois somem
                sozinhas.
              </p>
            </div>
          ) : (
            <div className="flex-1 space-y-2.5 overflow-y-auto p-3">
              {mensagens.map((m) =>
                m.autor === "user" ? (
                  <div key={m.id} className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground">
                      <p className="whitespace-pre-wrap">{m.texto}</p>
                      <p className="mt-0.5 flex items-center justify-end gap-1 text-[10px] opacity-90">
                        {m.hora}
                        {m.entrega && <Vistinho entrega={m.entrega} />}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div key={m.id} className="flex justify-start">
                    <div className="max-w-[90%] space-y-2">
                      <div className="rounded-2xl rounded-bl-sm border border-border bg-background px-3 py-2">
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.texto}</p>
                        {m.hora && (
                          <p className="mt-0.5 text-right text-[10px] text-muted-foreground">
                            {m.hora}
                          </p>
                        )}
                      </div>
                      {m.links && m.links.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {m.links.map((l) => (
                            <Link
                              key={l.rota}
                              href={l.rota}
                              onClick={() => setAberto(false)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
                            >
                              {l.nome}
                              <ArrowRight className="size-3" />
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ),
              )}

              {/* atalhos só enquanto a conversa não começou */}
              {mensagens.length === 1 && !ocupado && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {prontas.map(({ pergunta: s }) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => perguntar(s)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                    >
                      <Sparkles className="size-3 text-primary" />
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {digitando && <Digitando />}

              {/* o balão que está "sendo escrito" agora. Só na conversa dele:
                  a pessoa pode trocar de conversa no meio da resposta */}
              {parcial && parcial.conversa === atualId && (
                <div className="flex justify-start">
                  <div className="max-w-[90%] rounded-2xl rounded-bl-sm border border-border bg-background px-3 py-2">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">
                      {parcial.texto}
                      <span className="ml-0.5 inline-block h-3.5 w-px animate-pulse bg-foreground/70 align-middle" />
                    </p>
                  </div>
                </div>
              )}

              {demorando && (
                <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
                  Estou digitando uma resposta caprichada, só um instante.
                </p>
              )}
              <div ref={fimRef} />
            </div>
          )}

          {!vendoLista && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                perguntar(texto);
              }}
              className="flex items-center gap-2 border-t border-border p-2.5"
            >
              <input
                ref={entradaRef}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onFocus={aquecer}
                maxLength={500}
                placeholder="Escreva sua mensagem"
                className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none transition-colors focus:border-primary/60"
              />
              <button
                type="submit"
                disabled={ocupado || !texto.trim()}
                aria-label="Enviar mensagem"
                className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                <Send className="size-4" />
              </button>
            </form>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => (aberto ? setAberto(false) : abrirWidget())}
        aria-label={aberto ? "Fechar conversa com o suporte" : "Falar com o suporte"}
        // a folga horizontal dobra só no desktop (`sm:`): no celular ela comeria
        // a largura útil da caixa de conversa
        // z-40 e NÃO z-50: as telas cheias do painel (player de vídeo, modais de
        // compra e bônus, gaveta do menu no celular) ficam no z-50, e no empate
        // o botão vencia por ser renderizado depois, aparecendo flutuando por
        // cima do vídeo. Abaixo delas, o botão some enquanto o modal está aberto.
        // no desktop a folga de baixo é IGUAL à da direita (5rem nas duas), que é
        // o que faz o botão parecer bem posicionado no canto. No celular ela
        // continua menor, senão come a largura e a altura úteis da conversa.
        className="fixed bottom-12 right-6 z-40 grid size-14 place-items-center rounded-full border border-primary/40 bg-card text-primary shadow-xl ring-4 ring-primary/10 transition-transform hover:scale-105 sm:bottom-20 sm:right-20"
      >
        {aberto ? (
          <X className="size-6" />
        ) : (
          <>
            <MessageCircleMore className="size-6" />
            {/* bolinha verde: dá a entender que tem alguém do outro lado agora */}
            <span className="absolute right-1 top-1 size-3.5 rounded-full border-2 border-card bg-emerald-500" />
          </>
        )}
      </button>
    </>
  );
}
