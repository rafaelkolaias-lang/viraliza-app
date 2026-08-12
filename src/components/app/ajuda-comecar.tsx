import Link from "next/link";
import {
  Clock,
  Coins,
  Crown,
  FlaskConical,
  Gauge,
  Layers,
  Medal,
  Receipt,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import {
  Atalho,
  Aviso,
  Cartao,
  Passo,
  Secao,
  Selo,
  Tabela,
  Texto,
  Titulinho,
} from "@/components/app/ajuda-blocos";
import { CREDITOS_FIXO } from "@/lib/precos";
import { CUSTO_PROMPT_LAB } from "@/lib/lab-custos";

/**
 * Grupo "Começando": o que fazer no primeiro dia, como o dinheiro funciona
 * (assinatura x crédito) e o que muda com o nível da conta.
 */
export function AjudaComecar() {
  return (
    <>
      {/* ================= PRIMEIROS PASSOS ================= */}
      <Secao
        id="primeiros-passos"
        titulo="Primeiros passos"
        subtitulo="Se você acabou de entrar e não sabe por onde começar, é por aqui."
      >
        <Texto>
          O Viraliza faz vídeo de propaganda com inteligência artificial. Você escolhe
          um produto e uma pessoa pra anunciar, e a plataforma monta a cena, gera a
          imagem e transforma em vídeo. Você não precisa gravar nada, não precisa
          aparecer e não precisa saber editar.
        </Texto>

        <Titulinho>O caminho do primeiro dia</Titulinho>
        <div className="space-y-4">
          <Passo n={1} titulo="Comece pelo Viraliza Labs" Icone={FlaskConical}>
            É a tela que abre sozinha quando você faz login. Ela te guia por perguntas,
            uma de cada vez, até o vídeo ficar pronto. Não tente começar pelo Editor
            automático: ele é pra quem já tem o vídeo gravado.
          </Passo>
          <Passo n={2} titulo="Use um influenciador de graça no primeiro teste" Icone={Sparkles}>
            A plataforma tem 9 influenciadores prontos que todo mundo pode usar sem
            gastar nada. Faça o primeiro vídeo com um deles pra aprender o caminho antes
            de criar o seu.
          </Passo>
          <Passo n={3} titulo="Espere o vídeo ficar pronto" Icone={Clock}>
            Vídeo de IA demora alguns minutos. Você pode fechar a aba e voltar depois:
            a produção continua rodando no servidor, não no seu computador.
          </Passo>
          <Passo n={4} titulo="Baixe em Meus vídeos" Icone={Layers}>
            Todo vídeo que fica pronto cai na tela{" "}
            <strong className="text-foreground">Meus vídeos</strong>, com botão de
            baixar. De lá você posta onde quiser.
          </Passo>
        </div>

        <Aviso tom="dica" titulo="A regra de ouro pra economizar">
          Quase tudo que é <strong className="text-foreground">texto</strong> na
          plataforma (a IA escrever a cena, a fala, a ficha do influenciador, o roteiro) é
          de graça e você pode refazer quantas vezes quiser. A exceção é o Gerador de
          prompt, que custa {CUSTO_PROMPT_LAB} créditos porque lê as suas fotos. O que
          consome crédito mesmo é a{" "}
          <strong className="text-foreground">imagem</strong> e o{" "}
          <strong className="text-foreground">vídeo</strong>. Então capriche no texto
          antes de mandar gerar.
        </Aviso>

        <Atalho href="/painel/lab">Abrir o Viraliza Labs</Atalho>
      </Secao>

      {/* ================= CRÉDITOS E ASSINATURA ================= */}
      <Secao
        id="creditos"
        titulo="Créditos e assinatura"
        subtitulo="São duas coisas diferentes, e confundir as duas é a dúvida mais comum aqui."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Cartao Icone={Crown} titulo="A assinatura libera a biblioteca">
            É o que dá acesso ao acervo de cortes, aos vídeos virais, aos produtos da
            Shopee e do TikTok, ao Minerador e à área de membros. Ela vence e precisa
            ser renovada todo mês. A data de vencimento fica na aba{" "}
            <Link href="/painel/assinatura" className="text-primary hover:underline">
              Assinatura
            </Link>
            .
          </Cartao>
          <Cartao Icone={Coins} titulo="O crédito paga a produção">
            É o que paga cada imagem e cada vídeo que a IA gera pra você. Cada pacote
            comprado vale 90 dias, e o gasto sai sempre do pacote mais antigo
            primeiro.
          </Cartao>
        </div>

        <Texto>
          Quem assina ganha{" "}
          <strong className="text-foreground">3.000 créditos por mês</strong>{" "}
          enquanto a assinatura estiver em dia. Precisando de mais, dá pra comprar
          pacote avulso na aba Créditos.
        </Texto>

        <Titulinho>Quanto custa cada coisa</Titulinho>
        <Tabela
          colunas={["O que você faz", "Créditos"]}
          linhas={[
            ["Imagem no Viraliza Labs ou cena do Viral Boost", "20"],
            ["Vídeo de 6 segundos", "50"],
            ["Vídeo de 10 segundos", "70"],
            ["Vídeo de 15 segundos", "95"],
            ["Vídeo com influenciador falando (6s / 10s / 15s)", "50 / 70 / 95"],
            ["Criar um influenciador com IA", "20"],
            ["Enviar a imagem de um influenciador pronto", "0 (de graça)"],
            ["Textos escritos pela IA (cena, fala, ficha, roteiro)", "0 (de graça)"],
            ["Gerador de prompt (a IA lê suas fotos)", String(CUSTO_PROMPT_LAB)],
            ["Editor automático e Cortes (usando IA)", "Pelo uso real"],
            ["Editor automático no modo sem IA", String(CREDITOS_FIXO.editorManual)],
            ["Criar um Corte", String(CREDITOS_FIXO.editorManual)],
            [
              "Editor: a IA descrever uma cena de apoio (opcional)",
              String(CREDITOS_FIXO.analiseCena),
            ],
            ["Marca em lote (por vídeo carimbado)", String(CREDITOS_FIXO.lote)],
            ["MapsLeads (por busca)", String(CREDITOS_FIXO.leads)],
          ]}
        />
        <Texto>
          Vídeo com influenciador <strong className="text-foreground">sem fala</strong>{" "}
          custa o mesmo que o falado: o motor é o mesmo e o que conta é a duração em
          segundos do vídeo gerado, com ou sem voz. No Editor automático e no Cortes
          usando IA não tem preço fixo: a cobrança sai pelo que a inteligência
          artificial realmente consumiu naquele vídeo, e aparece detalhada no extrato.
          Já o que <strong className="text-foreground">não usa IA</strong> (a marca em
          lote, o MapsLeads e o editor no modo sem IA) tem valor fechado, que é só o
          custo de processamento.
        </Texto>

        <Aviso tom="dica" titulo="Deu erro? Não foi cobrado">
          A plataforma confere o saldo antes e só desconta{" "}
          <strong className="text-foreground">depois</strong> que a imagem ou o vídeo
          existe de verdade. Se a geração falhar no meio, nada é descontado. Se você
          achar que foi cobrado errado, confira no{" "}
          <Link href="/painel/extrato" className="text-primary hover:underline">
            Extrato
          </Link>{" "}
          e fale com a gente.
        </Aviso>

        <Titulinho>O crédito comprado cai inteiro na hora</Titulinho>
        <Texto>
          Assim que o pagamento é confirmado, <strong className="text-foreground">100%
          do crédito</strong> entra no seu saldo, de uma vez. Não existe mais a regra
          antiga que segurava parte da compra por alguns dias de garantia.
        </Texto>
        <div className="flex flex-wrap gap-3">
          <Selo Icone={Wallet}>
            Pagou, caiu: o valor inteiro aparece no{" "}
            <strong className="text-foreground">saldo</strong>
          </Selo>
          <Selo Icone={Clock}>
            Compra antiga com <strong className="text-foreground">crédito liberando</strong>?
            O resto cai sozinho na data mostrada
          </Selo>
        </div>

        <Aviso tom="atencao" titulo="Saldo pendente de reembolso">
          Se você pediu reembolso de uma compra depois de já ter gastado aqueles
          créditos, a conta fica com um saldo pendente e{" "}
          <strong className="text-foreground">para de gerar vídeos</strong> até
          regularizar. Comprando crédito de novo, o pendente é quitado automaticamente e
          a conta volta a funcionar.
        </Aviso>

        <div className="flex flex-wrap gap-2">
          <Atalho href="/painel/creditos">Ver meu saldo e comprar</Atalho>
          <Link
            href="/painel/assinatura"
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold transition-colors hover:border-primary/50"
          >
            <Crown className="size-4 text-primary" />
            Ver minha assinatura
          </Link>
          <Link
            href="/painel/extrato"
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold transition-colors hover:border-primary/50"
          >
            <Receipt className="size-4 text-primary" />
            Ver o extrato
          </Link>
        </div>
      </Secao>

      {/* ================= NÍVEIS ================= */}
      <Secao
        id="niveis"
        titulo="Níveis da conta"
        subtitulo="Bronze, Prata e Ouro hoje são reconhecimento: não limitam mais nada."
      >
        <Texto>
          Toda conta começa no <strong className="text-foreground">Bronze</strong> e vai
          subindo sozinha conforme você usa a plataforma, com aviso no sininho quando
          acontece. O nível <strong className="text-foreground">não limita mais
          nada</strong>: não existe limite diário de vídeos e o crédito comprado cai
          inteiro na hora, em qualquer nível. Em breve os níveis vão fazer parte de um
          sistema de recompensas da plataforma.
        </Texto>

        <Titulinho>A única regra de processamento</Titulinho>
        <Texto>
          Cada conta pode ter até{" "}
          <strong className="text-foreground">5 vídeos em produção ao mesmo
          tempo</strong>. É uma regra única da plataforma, igual pra todo mundo, e serve
          só pra fila de renderização andar pra todos. Chegou em 5, é esperar algum
          terminar pra mandar o próximo - esperar não gasta crédito nenhum.
        </Texto>

        <div className="flex flex-wrap gap-3">
          <Selo Icone={Gauge}>
            Sem limite diário: gere quantos vídeos quiser no dia
          </Selo>
          <Selo Icone={ShieldCheck}>
            Até <strong className="text-foreground">5 vídeos</strong> em produção ao
            mesmo tempo por conta
          </Selo>
          <Selo Icone={Medal}>O nível sobe sozinho com o uso</Selo>
        </div>

        <Atalho href="/painel/creditos">Ver o nível da minha conta</Atalho>
      </Secao>
    </>
  );
}
