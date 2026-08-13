import Link from "next/link";
import {
  Clock,
  Coins,
  Crown,
  FlaskConical,
  Layers,
  Medal,
  Receipt,
  ShieldCheck,
  Sparkles,
  Trophy,
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
import { CREDITOS_FIXO } from "@/lib/precos";
import { CUSTO_IMAGEM_LAB, CUSTO_PROMPT_LAB, custoVideoLab } from "@/lib/lab-custos";
import { CUSTO_AVATAR } from "@/lib/avatar-modelo";
import { CREDITO_MENSAL_CENTAVOS } from "@/lib/creditos";
import { NIVEIS, SIMULTANEOS_UNIVERSAL } from "@/lib/niveis";
import { BONUS_IG_CREDITOS } from "@/lib/promos";

/**
 * Grupo "Começando": o que fazer no primeiro dia, como o dinheiro funciona
 * (assinatura x crédito) e o que é o nível da conta.
 *
 * NENHUM preço, prazo ou limite é escrito na mão aqui: tudo sai das constantes
 * que a plataforma usa pra cobrar de verdade (`lab-custos`, `precos`,
 * `avatar-modelo`, `creditos`, `niveis`, `promos`). A tabela desta tela já ficou
 * meses mentindo o preço do vídeo por ter sido digitada na mão - não repita.
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
            Ela te guia por perguntas, uma de cada vez, até o vídeo ficar pronto. Não
            tente começar pelos editores automáticos: eles são pra quem já tem o vídeo
            gravado.
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
            É o que paga cada imagem e cada vídeo que a IA gera pra você. Crédito não
            vence: o que sobrar continua na conta.
          </Cartao>
        </div>

        <Texto>
          Quem entra pela assinatura ganha{" "}
          <strong className="text-foreground">
            {CREDITO_MENSAL_CENTAVOS.toLocaleString("pt-BR")} créditos
          </strong>{" "}
          na hora, e a mesma quantidade de novo a cada{" "}
          <strong className="text-foreground">renovação paga</strong>. Dá pra somar{" "}
          <strong className="text-foreground">+{BONUS_IG_CREDITOS}</strong> na tarefa do
          Instagram, e precisando de mais é só comprar pacote avulso na aba Créditos.
        </Texto>

        <Titulinho>Quanto custa cada coisa</Titulinho>
        <Tabela
          colunas={["O que você faz", "Créditos"]}
          linhas={[
            ["Imagem no Viraliza Labs ou cena do Viral Boost", String(CUSTO_IMAGEM_LAB)],
            ["Vídeo de 6 segundos", String(custoVideoLab("6s"))],
            ["Vídeo de 10 segundos", String(custoVideoLab("10s"))],
            ["Vídeo de 15 segundos", String(custoVideoLab("15s"))],
            ["Criar um influenciador com IA", String(CUSTO_AVATAR)],
            ["Enviar a imagem de um influenciador pronto", "0 (de graça)"],
            ["Textos escritos pela IA (cena, fala, ficha, roteiro)", "0 (de graça)"],
            ["Gerador de prompt (a IA lê suas fotos)", String(CUSTO_PROMPT_LAB)],
            ["Editores automáticos e Cortes (usando IA)", "Pelo uso real"],
            ["Editor automático no modo sem IA", String(CREDITOS_FIXO.editorManual)],
            ["Criar um Corte (não usa IA)", String(CREDITOS_FIXO.editorManual)],
            [
              "A IA descrever ou posicionar uma cena no Editor PRO",
              `${CREDITOS_FIXO.analiseCena} por cena`,
            ],
            ["Marca em lote (por vídeo carimbado)", String(CREDITOS_FIXO.lote)],
            ["MapsLeads (por busca)", String(CREDITOS_FIXO.leads)],
          ]}
        />
        <Texto>
          O vídeo custa <strong className="text-foreground">o mesmo com ou sem o
          influenciador falando</strong>: o que pesa é o tempo de vídeo que a IA precisa
          gerar, não a fala. Nos editores automáticos e no Cortes usando IA não tem preço
          fixo: a cobrança sai pelo que a inteligência artificial realmente consumiu
          naquele vídeo, e aparece detalhada no extrato. Já o que{" "}
          <strong className="text-foreground">não usa IA</strong> (a marca em lote, o
          MapsLeads, o Criar um Corte e o editor no modo sem IA) tem valor fechado, que é
          só o custo de processamento.
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

        <Titulinho>Comprei crédito, quando ele entra?</Titulinho>
        <Texto>
          Na hora em que o pagamento é confirmado, e{" "}
          <strong className="text-foreground">por inteiro</strong>. Não existe mais
          crédito reservado nem liberação em partes: o que você comprou já está todo no
          saldo. Em Pix a confirmação costuma levar poucos minutos; em cartão, o prazo é
          o da própria operadora.
        </Texto>
        <Texto>
          Se você é cliente antigo e ainda vê um{" "}
          <strong className="text-foreground">crédito liberando</strong> com data na tela
          de Créditos, é resto da regra antiga de garantia: ele cai sozinho naquela data,
          sem você precisar pedir nada.
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
        subtitulo="Bronze, Prata e Ouro. É uma medalha pelo tanto que você já produziu, e só."
      >
        <Aviso tom="dica" titulo="O nível não limita nada">
          Ele não segura crédito, não cria teto de vídeos por dia e não muda o que você
          pode usar. Quem pagou usa o que comprou, esteja no Bronze ou no Ouro. Se você
          viu em algum lugar que o nível dá &quot;5 vídeos por dia&quot; ou parecido, é
          texto antigo: essa regra acabou.
        </Aviso>

        <Texto>
          A régua é uma só, e é a mais simples possível:{" "}
          <strong className="text-foreground">quantos vídeos você já gerou</strong> na
          plataforma. Toda conta começa no Bronze e sobe sozinha.
        </Texto>

        <Tabela
          colunas={["Nível", "Quando você chega nele"]}
          linhas={[
            [`${NIVEIS.bronze.emoji} ${NIVEIS.bronze.rotulo}`, "Onde toda conta começa"],
            [
              `${NIVEIS.prata.emoji} ${NIVEIS.prata.rotulo}`,
              `A partir de ${NIVEIS.prata.videosMin} vídeos gerados`,
            ],
            [
              `${NIVEIS.ouro.emoji} ${NIVEIS.ouro.rotulo}`,
              `A partir de ${NIVEIS.ouro.videosMin} vídeos gerados`,
            ],
          ]}
        />

        <div className="flex flex-wrap gap-3">
          <Selo Icone={Trophy}>
            Sobe sozinho, sem pedir nada, e o sininho avisa
          </Selo>
          <Selo Icone={Medal}>
            A medalha <strong className="text-foreground">não volta atrás</strong>: quem
            chegou no Ouro não perde
          </Selo>
          <Selo Icone={ShieldCheck}>
            Pedir reembolso ou deixar a assinatura vencer não derruba o nível
          </Selo>
        </div>

        <Titulinho>Então o que pode travar a produção?</Titulinho>
        <div className="space-y-3">
          <Problema pergunta="Vídeos em produção ao mesmo tempo">
            Uma conta pode ter até{" "}
            <strong className="text-foreground">
              {SIMULTANEOS_UNIVERSAL} vídeos sendo produzidos ao mesmo tempo
            </strong>
            . Não tem nada a ver com nível: é igual pra todo mundo, porque a fila de
            produção é compartilhada. Assim que um termina, você manda o próximo.
          </Problema>
          <Problema pergunta="Saldo pendente de reembolso">
            É o único bloqueio de verdade da conta, e some assim que você compra crédito
            de novo.
          </Problema>
          <Problema pergunta="Assinatura vencida">
            Trava só a biblioteca (acervo, virais, Shopee, TikTok, Minerador e área de
            membros). As ferramentas de produção continuam funcionando com o seu crédito.
          </Problema>
        </div>

        <Atalho href="/painel/creditos">Ver o nível da minha conta</Atalho>
      </Secao>
    </>
  );
}
