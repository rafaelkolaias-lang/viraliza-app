"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronRight, MessageCircle, MessageCircleMore, X } from "lucide-react";
import { ChatEquipe } from "@/components/app/chat-widget";
import { SuporteChat } from "@/components/app/suporte-chat";

/**
 * Boia ÚNICA do canto de baixo (12/08/2026).
 *
 * Antes eram DUAS boias empilhadas: o robô de suporte em `bottom-12` e o chat
 * com a equipe em `bottom-28`. As duas redondas, as duas com ícone de balão, a
 * 8px uma da outra — no celular liam como o mesmo botão repetido. E a de cima
 * caía EXATAMENTE na faixa da barrinha de ferramentas (`lab-dock.tsx` sobe pra
 * `bottom-28` no celular), no mesmo `z-40`, cobrindo os últimos ícones dela.
 * Pior: nada coordenava as duas, então as janelas abriam JUNTAS — mesma largura,
 * mesmo `z-[60]`, uma tapando a outra.
 *
 * Agora é um botão só, na posição que era a do suporte: a faixa de 3rem a 6,5rem
 * do rodapé, que é justamente a que a barrinha de ferramentas já sabe desviar.
 * Um painel de cada vez, pela mesma razão.
 *
 * **Sem conversa com a equipe (a maioria), o botão abre o robô direto.** Menu de
 * um item só é clique a mais pra chegar no mesmo lugar; o seletor só aparece
 * quando existem de fato as duas opções.
 */

type Painel = "suporte" | "equipe";

export function ChatBoia({
  creditoMensal,
  /** admin não tem "falar com a equipe" (a equipe é ele): nem poll, nem seletor */
  comEquipe,
}: {
  creditoMensal: number;
  comEquipe: boolean;
}) {
  const [painel, setPainel] = useState<Painel | null>(null);
  const [menu, setMenu] = useState(false);
  /** o admin já abriu conversa com esta pessoa? (só então existe a 2ª opção) */
  const [temEquipe, setTemEquipe] = useState(false);
  const [naoLidas, setNaoLidas] = useState(0);
  /** o poll roda fora do render: precisa saber se a conversa está ABERTA agora.
   *  Espelhado por efeito, não durante a renderização (mexer em ref no meio da
   *  pintura é o que o `react-hooks/refs` proíbe). */
  const painelRef = useRef<Painel | null>(null);
  useEffect(() => {
    painelRef.current = painel;
  }, [painel]);

  /**
   * Badge: existe conversa? não lidas? (a cada 30s; leve)
   *
   * Mora AQUI e não no painel da equipe porque o painel só é montado quando
   * aberto — e a bolinha de não lidas precisa aparecer com tudo fechado.
   */
  useEffect(() => {
    if (!comEquipe) return;
    let cancelado = false;
    async function resumo() {
      try {
        const r = await fetch("/api/chat?resumo=1", { cache: "no-store" });
        if (!r.ok) return;
        const d = (await r.json()) as { existe?: boolean; naoLidas?: number };
        if (cancelado) return;
        setTemEquipe(!!d.existe);
        // com a conversa aberta na tela, o `?ler=1` do painel já zerou: um poll
        // que chegasse no meio traria o número velho e reacenderia o badge
        if (painelRef.current !== "equipe") setNaoLidas(d.naoLidas ?? 0);
      } catch {
        /* sem rede: tenta no próximo ciclo */
      }
    }
    resumo();
    const id = setInterval(resumo, 30_000);
    return () => {
      cancelado = true;
      clearInterval(id);
    };
  }, [comEquipe]);

  function abrir(escolha: Painel) {
    setMenu(false);
    setPainel(escolha);
    if (escolha === "equipe") setNaoLidas(0);
  }

  function clicarBoia() {
    if (painel) return setPainel(null); // aberto: a boia vira o "fechar"
    if (menu) return setMenu(false);
    if (temEquipe) setMenu(true);
    else abrir("suporte");
  }

  const fechado = !painel && !menu;

  return (
    <>
      <SuporteChat
        creditoMensal={creditoMensal}
        aberto={painel === "suporte"}
        onFechar={() => setPainel(null)}
      />
      {/* montado só quando aberto: o poll de mensagens é de 5 em 5 segundos, não
          faz sentido rodar com a caixa fechada (o resumo aqui em cima já cobre o
          badge). O robô, ao contrário, fica SEMPRE montado — ver suporte-chat */}
      {painel === "equipe" && <ChatEquipe onFechar={() => setPainel(null)} />}

      {/* clicar fora fecha o seletor. `cursor-pointer` é obrigatório p/ o iOS
          disparar onClick em <div>; sem fundo, porque escurecer a tela inteira
          por causa de um menu de dois itens seria exagero */}
      {menu && (
        <div
          onClick={() => setMenu(false)}
          aria-hidden
          className="fixed inset-0 z-[55] cursor-pointer"
        />
      )}

      {menu && (
        // mesma âncora das duas janelas: o seletor abre onde a conversa vai abrir
        <div
          role="menu"
          aria-label="Escolha com quem falar"
          className="fixed bottom-28 right-6 z-[60] w-[calc(100vw-3rem)] max-w-xs overflow-hidden rounded-2xl border border-border bg-card shadow-2xl sm:bottom-36 sm:right-20"
        >
          <p className="border-b border-border bg-primary/10 px-3.5 py-2.5 text-sm font-bold">
            Com quem você quer falar?
          </p>
          <div className="space-y-1 p-1.5">
            <OpcaoChat
              Icone={MessageCircleMore}
              titulo="Suporte (robô)"
              descricao="Responde na hora, a qualquer momento"
              onClick={() => abrir("suporte")}
            />
            <OpcaoChat
              Icone={MessageCircle}
              titulo="Equipe Viraliza"
              descricao="Fale com uma pessoa do time"
              naoLidas={naoLidas}
              onClick={() => abrir("equipe")}
            />
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={clicarBoia}
        aria-haspopup={temEquipe ? "menu" : undefined}
        aria-expanded={!fechado}
        aria-label={fechado ? "Abrir conversa" : "Fechar conversa"}
        // z-40 e NÃO z-50: as telas cheias do painel (player de vídeo, modais de
        // compra e bônus, gaveta do menu no celular) ficam no z-50, e no empate
        // o botão vencia por ser renderizado depois, aparecendo flutuando por
        // cima do vídeo. Abaixo delas, o botão some enquanto o modal está aberto.
        // no desktop a folga de baixo é IGUAL à da direita (5rem nas duas), que é
        // o que faz o botão parecer bem posicionado no canto. No celular ela
        // continua menor, senão come a largura e a altura úteis da conversa.
        className="fixed bottom-12 right-6 z-40 grid size-14 place-items-center rounded-full border border-primary/40 bg-card text-primary shadow-xl ring-4 ring-primary/10 transition-transform hover:scale-105 sm:bottom-20 sm:right-20"
      >
        {fechado ? (
          <>
            <MessageCircleMore className="size-6" />
            {naoLidas > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full border-2 border-card bg-orange-500 px-1 text-[11px] font-bold text-white">
                {naoLidas > 9 ? "9+" : naoLidas}
              </span>
            ) : (
              // bolinha verde: dá a entender que tem alguém do outro lado agora
              <span className="absolute right-1 top-1 size-3.5 rounded-full border-2 border-card bg-emerald-500" />
            )}
          </>
        ) : (
          <X className="size-6" />
        )}
      </button>
    </>
  );
}

function OpcaoChat({
  Icone,
  titulo,
  descricao,
  naoLidas = 0,
  onClick,
}: {
  Icone: typeof MessageCircle;
  titulo: string;
  descricao: string;
  naoLidas?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl border border-transparent px-2.5 py-2.5 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
        <Icone className="size-4.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{titulo}</span>
        <span className="block truncate text-[11px] text-muted-foreground">{descricao}</span>
      </span>
      {naoLidas > 0 && (
        <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-orange-500 px-1 text-[11px] font-bold text-white">
          {naoLidas > 9 ? "9+" : naoLidas}
        </span>
      )}
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </button>
  );
}
