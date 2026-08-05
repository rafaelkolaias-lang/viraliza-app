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
  Problema,
  Secao,
  Selo,
  Tabela,
  Texto,
  Titulinho,
} from "@/components/app/ajuda-blocos";

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
          Tudo que é <strong className="text-foreground">texto</strong> na plataforma
          (a IA escrever a cena, a fala, a ficha do influenciador, o roteiro) é de graça
          e você pode refazer quantas vezes quiser. O que consome crédito é a{" "}
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
            É o que paga cada imagem e cada vídeo que a IA gera pra você. Crédito não
            vence: o que sobrar continua na conta.
          </Cartao>
        </div>

        <Texto>
          Quem entra pela assinatura ganha{" "}
          <strong className="text-foreground">1.000 créditos</strong> de boas-vindas, e
          mais <strong className="text-foreground">2.000 créditos por mês</strong>{" "}
          enquanto a assinatura estiver em dia. Precisando de mais, dá pra comprar
          pacote avulso na aba Créditos.
        </Texto>

        <Titulinho>Quanto custa cada coisa</Titulinho>
        <Tabela
          colunas={["O que você faz", "Créditos"]}
          linhas={[
            ["Imagem no Viraliza Labs ou cena do Viral Boost", "20"],
            ["Vídeo de 6 segundos", "30"],
            ["Vídeo de 10 segundos", "50"],
            ["Vídeo de 15 segundos", "75"],
            ["Vídeo com influenciador falando (6s / 10s / 15s)", "40 / 50 / 50"],
            ["Criar um influenciador com IA", "40"],
            ["Enviar a imagem de um influenciador pronto", "0 (de graça)"],
            ["Textos escritos pela IA (cena, fala, ficha, roteiro)", "0 (de graça)"],
            ["Editor automático, Cortes, Marca em lote, MapsLeads", "Pelo uso real"],
          ]}
        />
        <Texto>
          Vídeo com influenciador <strong className="text-foreground">sem fala</strong>{" "}
          custa 10 créditos a menos. Nas ferramentas antigas (editor, cortes, lote e
          leads) não tem preço fixo: a cobrança sai pelo que a inteligência artificial
          realmente consumiu naquele vídeo, e aparece detalhada no extrato.
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

        <Titulinho>Comprei crédito e só entrou uma parte</Titulinho>
        <Texto>
          Isso é normal e está certo. Toda compra de pacote entra em duas partes: uma
          cai no saldo na hora e o resto fica reservado por{" "}
          <strong className="text-foreground">8 dias</strong>, que é o prazo de garantia
          da compra. Passados os 8 dias, o restante cai sozinho no seu saldo, sem você
          precisar pedir nada.
        </Texto>
        <div className="flex flex-wrap gap-3">
          <Selo Icone={Wallet}>
            A parte que já entrou aparece no <strong className="text-foreground">saldo</strong>
          </Selo>
          <Selo Icone={Clock}>
            A parte reservada aparece como{" "}
            <strong className="text-foreground">crédito liberando</strong>, com a data
          </Selo>
        </div>
        <Texto>
          Quanto libera na hora depende do nível da sua conta (é o próximo assunto).
          Contas mais antigas liberam mais na hora, e a conta Ouro libera quase tudo na
          hora.
        </Texto>

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
        subtitulo="Bronze, Prata e Ouro. O nível define quantos vídeos você faz por dia."
      >
        <Texto>
          Toda conta começa no <strong className="text-foreground">Bronze</strong> e vai
          subindo sozinha conforme você usa a plataforma. Quanto mais alto o nível,
          maior o limite diário, mais vídeos podem ser produzidos ao mesmo tempo e mais
          crédito comprado cai no saldo na hora.
        </Texto>

        <Tabela
          colunas={["Nível", "Vídeos por dia", "Ao mesmo tempo", "Crédito comprado"]}
          linhas={[
            ["🥉 Bronze", "5", "1 vídeo", "Metade na hora, resto em 8 dias"],
            ["🥈 Prata", "12", "2 vídeos", "Metade na hora, com limite maior"],
            ["🥇 Ouro", "50", "3 vídeos", "75% na hora, sem limite"],
          ]}
        />

        <Titulinho>Como subir de nível</Titulinho>
        <Texto>
          Não tem botão nem pedido: é automático. Conta que tem mais tempo de casa, que
          entra com frequência e que continua comprando sobe sozinha, e você recebe um
          aviso no sininho quando isso acontece. Pro nível Ouro também é preciso estar
          com a assinatura em dia.
        </Texto>

        <Titulinho>O que faz o nível cair</Titulinho>
        <div className="space-y-3">
          <Problema pergunta="Pedir reembolso de uma compra">
            A conta volta pro Bronze. Se o reembolso for cancelado, o nível volta ao que
            era antes.
          </Problema>
          <Problema pergunta="Ficar muito tempo sem entrar">
            Passando de 60 dias sem acessar, a conta desce um nível quando você voltar.
            Depois ela sobe de novo com o uso.
          </Problema>
          <Problema pergunta="Deixar a assinatura vencer">
            Quem está no Ouro cai pro Prata enquanto a assinatura estiver vencida. Seus
            créditos continuam valendo do mesmo jeito.
          </Problema>
        </div>

        <div className="flex flex-wrap gap-3">
          <Selo Icone={Gauge}>
            O quanto você já usou hoje aparece no card{" "}
            <strong className="text-foreground">Nível da conta</strong>
          </Selo>
          <Selo Icone={ShieldCheck}>
            Bater o limite do dia não gasta crédito nenhum
          </Selo>
          <Selo Icone={Medal}>O limite renova todo dia à meia-noite</Selo>
        </div>

        <Atalho href="/painel/creditos">Ver o nível da minha conta</Atalho>
      </Secao>
    </>
  );
}
