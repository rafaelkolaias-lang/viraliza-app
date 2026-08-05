import {
  Camera,
  Check,
  Coins,
  Dumbbell,
  Package,
  Palette,
  Scissors,
  Shirt,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Timer,
  Upload,
  UserRound,
  Wand2,
} from "lucide-react";
import {
  Atalho,
  Aviso,
  Cartao,
  Passo,
  Secao,
  Selo,
  Texto,
  Titulinho,
} from "@/components/app/ajuda-blocos";
import { CUSTO_AVATAR } from "@/lib/avatar-modelo";

/**
 * Grupo "Seu influenciador": o que é, como criar com IA (as 7 telas do quiz) e
 * as outras portas de entrada. É a parte com mais gente perdida, por isso o
 * passo a passo cita o nome exato de cada botão.
 */
export function AjudaInfluenciador() {
  return (
    <>
      {/* ================= O QUE É ================= */}
      <Secao
        id="influenciador"
        titulo="O que é um influenciador"
        subtitulo="A pessoa que aparece falando nos seus vídeos."
      >
        <Texto>
          O influenciador (também chamado de avatar) é o rosto do seu vídeo. É ele que
          segura o produto, fala com a câmera e faz a propaganda. Ele não existe de
          verdade: é uma pessoa criada por inteligência artificial, então você não
          precisa gravar nada, nem aparecer, nem contratar ninguém.
        </Texto>

        <div className="grid gap-3 sm:grid-cols-3">
          <Cartao Icone={Sparkles} titulo="Criar com IA">
            Você escolhe como ele é (rosto, corpo, cabelo, roupa) e a IA desenha a
            pessoa. Custa {CUSTO_AVATAR} créditos.
          </Cartao>
          <Cartao Icone={Upload} titulo="Enviar uma imagem">
            Já tem a foto de alguém pronta? Só subir. Não gasta nenhum crédito.
          </Cartao>
          <Cartao Icone={UserRound} titulo="Usar os da plataforma">
            São 9 influenciadores prontos, de graça, liberados pra todo mundo usar nos
            vídeos.
          </Cartao>
        </div>

        <Aviso tom="dica" titulo="Começando agora? Não crie nada ainda">
          Faça o primeiro vídeo com um influenciador{" "}
          <strong className="text-foreground">da plataforma</strong> (os de graça, lá
          embaixo da tela Personalize com IA). Assim você aprende o caminho todo sem
          gastar crédito. Depois que entender o fluxo, aí sim vale criar o seu.
        </Aviso>
      </Secao>

      {/* ================= CRIAR COM IA ================= */}
      <Secao
        id="criar-com-ia"
        titulo="Criar com IA, passo a passo"
        subtitulo="São 7 telinhas, uma pergunta de cada vez. Leva uns 2 minutos pra responder."
      >
        <div className="rounded-xl border border-border bg-background/50 p-4">
          <Titulinho>Onde fica esse botão</Titulinho>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            No menu do lado esquerdo, clique em{" "}
            <strong className="text-foreground">Personalize com IA</strong>. Na tela que
            abrir, clique no botão verde{" "}
            <strong className="text-foreground">Criar com IA</strong>, no topo.
          </p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            No celular o menu fica escondido: toque nas três listrinhas no canto de cima
            pra ele aparecer.
          </p>
        </div>

        <Titulinho>As 7 perguntas</Titulinho>
        <div className="space-y-4">
          <Passo n={1} titulo="Identidade" Icone={UserRound}>
            Nome, idade (de 18 a 75) e gênero. O nome é só pra você achar ele depois na
            sua lista, pode ser qualquer um. Sem preencher nome e idade o botão de
            avançar fica apagado.
          </Passo>
          <Passo n={2} titulo="Tom de pele" Icone={Palette}>
            Clique na amostra que mais parece com o público que você quer atingir.
          </Passo>
          <Passo n={3} titulo="Tipo físico" Icone={Dumbbell}>
            Aparecem bonecos com cada tipo de corpo. Clique em um.
          </Passo>
          <Passo n={4} titulo="Cor do cabelo" Icone={Palette}>
            Mesma coisa: clique na cor.
          </Passo>
          <Passo n={5} titulo="Estilo do cabelo" Icone={Scissors}>
            O corte. Aparecem só os cortes que combinam com o gênero que você escolheu no
            passo 1.
          </Passo>
          <Passo n={6} titulo="Detalhes" Icone={Wand2}>
            Aqui você liga ou desliga barba e óculos, e pode escrever traços extras
            (sardas, tatuagem, piercing). É opcional, mas é o que faz o rosto parecer de
            gente de verdade.
          </Passo>
          <Passo n={7} titulo="Camisa" Icone={Shirt}>
            Tipo e cor da camiseta. Prefira cor lisa e escura: camisa estampada rouba a
            atenção do produto no vídeo.
          </Passo>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-primary">
              <ThumbsUp className="size-3.5" />
              Bom exemplo de traços extras
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              &quot;Sardas no rosto, sobrancelha marcada, brinco pequeno de argola&quot;
            </p>
          </div>
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-destructive">
              <ThumbsDown className="size-3.5" />
              Exemplo ruim
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              &quot;Bonita, tipo aquela influencer famosa&quot;. A IA não sabe quem é, e o
              resultado sai qualquer coisa.
            </p>
          </div>
        </div>

        <Titulinho>Depois do último passo</Titulinho>
        <div className="flex flex-wrap gap-3">
          <Selo Icone={Coins}>
            Custa <strong className="text-foreground">{CUSTO_AVATAR} créditos</strong>
          </Selo>
          <Selo Icone={Timer}>
            Leva de <strong className="text-foreground">1 a 3 minutos</strong>
          </Selo>
          <Selo Icone={Check}>Fica salvo pra sempre na sua lista</Selo>
        </div>

        <Aviso tom="atencao" titulo="Clicou em Criar influenciador? Agora só espere">
          A tela fica escrito &quot;Criando...&quot; e demora mesmo, é normal. Você{" "}
          <strong className="text-foreground">pode</strong> sair da tela e navegar pela
          plataforma: ele aparece sozinho na sua lista quando ficar pronto. O que você{" "}
          <strong className="text-foreground">não</strong> pode é clicar de novo pra
          criar outro achando que deu erro, porque aí cobra os {CUSTO_AVATAR} créditos
          duas vezes.
        </Aviso>

        <Atalho href="/painel/meus-avatares">Abrir Personalize com IA</Atalho>
      </Secao>

      {/* ================= OUTRAS FORMAS ================= */}
      <Secao
        id="outras-formas"
        titulo="As outras 3 formas de criar"
        subtitulo="Nem sempre criar do zero é o melhor caminho."
      >
        <div className="space-y-3">
          <div className="rounded-xl border border-border bg-background/50 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Upload className="size-4 text-primary" />
              Enviar imagem
            </p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Botão ao lado do &quot;Criar com IA&quot;. Serve quando você já tem a
              imagem da pessoa salva no computador ou no celular.{" "}
              <strong className="text-foreground">Não gasta crédito nenhum.</strong>
            </p>
          </div>
          <div className="rounded-xl border border-border bg-background/50 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Camera className="size-4 text-primary" />
              Criar a partir de uma foto sua
            </p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              É o link escrito{" "}
              <strong className="text-foreground">Criar a partir de uma foto sua</strong>
              , logo abaixo dos dois botões. Use quando quiser que o influenciador seja
              parecido com você ou com alguém real.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-background/50 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Package className="size-4 text-primary" />
              Criar junto com um produto
            </p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Também é um link abaixo dos botões. Aqui o influenciador já nasce segurando
              o seu produto na mão, que é a imagem que mais vende.
            </p>
          </div>
        </div>

        <Aviso tom="dica" titulo="Na dúvida entre criar com IA ou enviar imagem">
          Se você já tem uma foto boa (rosto nítido, corpo inteiro ou meio corpo, fundo
          limpo), enviar a imagem é melhor: sai na hora e é de graça. Criar com IA vale
          quando você quer um rosto que não existe em lugar nenhum, só seu.
        </Aviso>

        <Texto>
          Na mesma tela tem a aba <strong className="text-foreground">Cenários</strong>,
          onde você guarda os seus próprios fundos (a sua loja, a sua cozinha, o seu
          estúdio) pra usar nos vídeos em vez dos cenários prontos.
        </Texto>
      </Secao>
    </>
  );
}
