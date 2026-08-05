import {
  Camera,
  Captions,
  Clapperboard,
  Coins,
  Compass,
  Film,
  Flame,
  Image as ImageIcon,
  Images,
  Link2,
  Mic,
  Music,
  PenLine,
  Scissors,
  Sparkles,
  Timer,
  Users,
  Video,
} from "lucide-react";
import {
  Atalho,
  Aviso,
  Cartao,
  Passo,
  Problema,
  Secao,
  Selo,
  Tabela,
  Texto,
  Titulinho,
} from "@/components/app/ajuda-blocos";

/**
 * Grupo "Criar vídeos": os quatro caminhos que geram vídeo, do mais novo
 * (Viraliza Labs, IA) pro mais antigo (Editor e Cortes, que montam em cima de
 * vídeo que já existe).
 */
export function AjudaVideos() {
  return (
    <>
      {/* ================= VIRALIZA LABS ================= */}
      <Secao
        id="labs"
        titulo="Viraliza Labs"
        subtitulo="O caminho principal: vira um produto em vídeo de propaganda, do zero."
      >
        <Texto>
          O Labs é uma esteira guiada. Ele pergunta uma coisa de cada vez, monta a cena,
          gera uma imagem e depois transforma essa imagem em vídeo. São{" "}
          <strong className="text-foreground">3 etapas grandes</strong>, e você vê em
          qual está pela trilha no topo da tela.
        </Texto>

        <div className="space-y-4">
          <Passo n={1} titulo="Criar cena" Icone={Compass}>
            Quatro perguntas seguidas: o{" "}
            <strong className="text-foreground">estilo de câmera</strong> (o jeitão do
            vídeo), o <strong className="text-foreground">produto</strong> (você envia a
            foto e descreve), o{" "}
            <strong className="text-foreground">influenciador</strong> e o{" "}
            <strong className="text-foreground">cenário</strong>. No fim aparece um
            resumo pra você conferir tudo antes de gastar. Essa etapa inteira é de graça.
          </Passo>
          <Passo n={2} titulo="Gerar imagem" Icone={ImageIcon}>
            A IA desenha a cena que você montou. Custa 20 créditos. Se a imagem sair
            estranha, você pode gerar de novo (aí cobra outra vez), então vale caprichar
            na descrição do produto antes.
          </Passo>
          <Passo n={3} titulo="Gerar vídeo" Icone={Video}>
            Aqui você escolhe a duração, se o influenciador vai falar e o que ele fala, e
            qual o movimento de câmera. Depois é só confirmar.
          </Passo>
        </div>

        <Titulinho>Quanto custa o vídeo</Titulinho>
        <Tabela
          colunas={["Duração", "Custo"]}
          linhas={[
            ["6 segundos", "50 créditos"],
            ["10 segundos", "70 créditos"],
            ["15 segundos", "95 créditos"],
          ]}
        />
        <Texto>
          O preço é o mesmo com ou sem o influenciador falando: o que pesa é o tempo de
          vídeo que a IA precisa gerar, não a fala. Vale pro Labs, pro Vídeo livre, pro
          vídeo com influenciador e pro Viral Boost.
        </Texto>

        <Aviso tom="atencao" titulo="Vídeo de 15 segundos aceita só 1 imagem">
          Nos vídeos de 6 e 10 segundos você pode mandar até 3 imagens de referência. No
          de 15 segundos o motor aceita{" "}
          <strong className="text-foreground">uma só</strong>. Se você escolher 15
          segundos com mais de uma imagem, a plataforma vai reclamar.
        </Aviso>

        <Titulinho>As 4 ferramentas do Labs</Titulinho>
        <Texto>
          Na barrinha flutuante embaixo da tela você troca entre elas:
        </Texto>
        <div className="grid gap-3 sm:grid-cols-2">
          <Cartao Icone={Compass} titulo="Caminho guiado">
            O funil de 3 etapas descrito acima. É por onde todo mundo deve começar.
          </Cartao>
          <Cartao Icone={Images} titulo="Minhas imagens">
            A galeria de tudo que você já gerou. Dá pra transformar uma imagem antiga em
            vídeo <strong className="text-foreground">sem pagar a imagem de novo</strong>
            .
          </Cartao>
          <Cartao Icone={Sparkles} titulo="Vídeo livre">
            Uma conversa solta: você escreve o que quer, anexa imagens, escolhe a duração
            e o idioma. É pra quem já sabe o que quer e não precisa do passo a passo.
          </Cartao>
          <Cartao Icone={PenLine} titulo="Gerador de prompt">
            Você manda a foto do produto e a IA escreve a descrição técnica pra você
            colar no campo. <strong className="text-foreground">É de graça</strong> e
            melhora muito o resultado da imagem.
          </Cartao>
        </div>

        <Aviso tom="dica" titulo="Pode fechar a aba">
          Depois que você confirma, a produção acontece no servidor, não no seu
          computador. Pode fechar o navegador, desligar o celular, sair pra almoçar: o
          vídeo aparece em <strong className="text-foreground">Meus vídeos</strong>{" "}
          quando ficar pronto. Mandar o mesmo pedido duas vezes seguidas também não cobra
          duas vezes, a plataforma percebe e reaproveita o que já está rodando.
        </Aviso>

        <Atalho href="/painel/lab">Abrir o Viraliza Labs</Atalho>
      </Secao>

      {/* ================= VIRAL BOOST ================= */}
      <Secao
        id="boost"
        titulo="Viral Boost"
        subtitulo="As historinhas virais de personagens, no estilo novela."
      >
        <Texto>
          É outro tipo de vídeo: em vez de propaganda de produto, são personagens vivendo
          uma historinha curta, do formato que viraliza sozinho. Também são passos
          guiados, e a lógica de crédito é a mesma do Labs.
        </Texto>

        <div className="space-y-4">
          <Passo n={1} titulo="Formato" Icone={Flame}>
            Escolha o tipo de historinha. Hoje tem o formato das frutas (até 3
            personagens) e o da senhora.
          </Passo>
          <Passo n={2} titulo="Personagens" Icone={Users}>
            Use o elenco pronto da plataforma ou os personagens que você mesmo criou.
          </Passo>
          <Passo n={3} titulo="Historinha" Icone={PenLine}>
            Tem 10 historinhas prontas pra escolher, e você também pode escrever a sua ou
            pedir pra IA escrever. Escrever é de graça.
          </Passo>
          <Passo n={4} titulo="Cenário" Icone={Camera}>
            Onde a cena acontece.
          </Passo>
          <Passo n={5} titulo="Gerar" Icone={Sparkles}>
            Confirma e espera. A imagem da cena é opcional.
          </Passo>
        </div>

        <Aviso tom="atencao" titulo="A duração é decidida pela quantidade de personagens">
          Você não escolhe o tempo do vídeo aqui. Com{" "}
          <strong className="text-foreground">1 personagem</strong> o vídeo sai com 15
          segundos; com <strong className="text-foreground">2 ou 3</strong>, sai com 10
          segundos. Isso é limitação do motor que gera o vídeo, não é erro.
        </Aviso>

        <Atalho href="/painel/viral-boost">Abrir o Viral Boost</Atalho>
      </Secao>

      {/* ================= EDITOR AUTOMÁTICO ================= */}
      <Secao
        id="editor"
        titulo="Editor automático"
        subtitulo="Pra quem JÁ tem o vídeo gravado e quer montar, legendar e narrar."
      >
        <Texto>
          Aqui a IA não inventa imagem nenhuma: ela pega os vídeos que você enviar, monta
          tudo no formato de celular, escreve a copy e coloca legenda ou narração. É o
          caminho certo quando você já tem material gravado ou baixado do acervo.
        </Texto>

        <Titulinho>Os 4 modos</Titulinho>
        <Tabela
          colunas={["Modo", "O que acontece"]}
          linhas={[
            ["Legenda", "A IA escreve a copy e queima a legenda no vídeo."],
            ["Voz narrada", "A IA escreve a copy e narra com voz de IA."],
            [
              "Transcrever fala",
              "Seu vídeo já tem alguém falando: a legenda entra no tempo certo da fala e o som original continua.",
            ],
            [
              "Nenhum",
              "Sai só a sua montagem, com o áudio e a música que você escolher. Sem legenda e sem voz de IA.",
            ],
          ]}
        />

        <Titulinho>O que mais aparece na tela</Titulinho>
        <div className="grid gap-3 sm:grid-cols-3">
          <Cartao Icone={Film} titulo="Onde você vai vender">
            Shopee ou outro. Isso muda a chamada final e as hashtags que a IA escreve.
          </Cartao>
          <Cartao Icone={Mic} titulo="Tom da copy">
            Agressivo, equilibrado ou tranquilo. Agressivo puxa mais urgência.
          </Cartao>
          <Cartao Icone={Music} titulo="Música e voz">
            Dá pra escolher a voz da narração e subir uma música de fundo.
          </Cartao>
        </div>

        <Aviso tom="atencao" titulo="Aqui o preço não é fixo">
          Quando a IA escreve ou narra, o editor cobra pelo que ela realmente consumiu
          naquele vídeo (quanto maior o texto e a narração, maior o valor). Por isso a
          tela mostra só uma <strong className="text-foreground">estimativa</strong>{" "}
          antes de gerar, e o valor certo aparece no extrato quando o vídeo fica pronto.
          No modo &quot;Nenhum&quot;, que não usa IA, a cobrança é um valor fixo de
          processamento.
        </Aviso>

        <Atalho href="/painel/novo">Abrir o Editor automático</Atalho>
      </Secao>

      {/* ================= CORTES ================= */}
      <Secao
        id="cortes"
        titulo="Cortes de qualquer vídeo"
        subtitulo="Cole um link do YouTube e a IA escolhe os melhores trechos."
      >
        <div className="space-y-4">
          <Passo n={1} titulo="Cole o link" Icone={Link2}>
            Só link do <strong className="text-foreground">YouTube</strong> por enquanto.
            Instagram e TikTok ainda não funcionam, mesmo aparecendo na tela.
          </Passo>
          <Passo n={2} titulo="Escolha a duração do corte" Icone={Timer}>
            30 segundos, 1 minuto ou 1 minuto e meio.
          </Passo>
          <Passo n={3} titulo="Ajuste a legenda" Icone={Captions}>
            Pode ligar ou desligar, e escolher a cor (amarelo, branco ou verde) e a
            posição na tela (em cima, no meio ou embaixo).
          </Passo>
          <Passo n={4} titulo="Gerar" Icone={Scissors}>
            A IA assiste o vídeo, escolhe o trecho mais forte, corta no formato de
            celular e legenda.
          </Passo>
        </div>

        <div className="flex flex-wrap gap-3">
          <Selo Icone={Clapperboard}>Vídeo muito longo demora mais pra processar</Selo>
          <Selo Icone={Coins}>
            O valor descontado aparece no extrato quando o corte fica pronto
          </Selo>
        </div>

        <Problema pergunta="Colei o link e deu erro na hora">
          Confira se o link é mesmo do YouTube e se o vídeo é público. Vídeo privado, não
          listado ou com restrição de idade não consegue ser baixado.
        </Problema>

        <Atalho href="/painel/cortes">Abrir os Cortes</Atalho>
      </Secao>
    </>
  );
}
