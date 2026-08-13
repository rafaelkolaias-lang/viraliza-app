import type { Metadata } from "next";
import Link from "next/link";
import { PaginaLegal, Secao } from "@/components/legal/pagina-legal";
import {
  EMPRESA,
  REEMBOLSO_CONSUMO_MAXIMO_PCT,
  REEMBOLSO_PRAZO_DIAS,
  VERSAO_REEMBOLSO,
} from "@/lib/legal";

export const metadata: Metadata = {
  title: "Política de Reembolso | Viraliza",
  description:
    "Prazos, condições e como pedir a devolução de uma compra no Viraliza.",
};

const linkClasse = "text-primary underline underline-offset-4";

export default function ReembolsoPage() {
  return (
    <PaginaLegal titulo="Política de Reembolso" versao={VERSAO_REEMBOLSO}>
      <p>
        Esta política é parte integrante dos{" "}
        <Link href="/termos" className={linkClasse}>
          Termos de Uso
        </Link>{" "}
        e explica quando uma compra no <b>{EMPRESA.nome}</b> pode ser devolvida,
        quanto volta e como pedir.
      </p>

      <Secao titulo="1. O prazo">
        <p>
          Você tem <b>{REEMBOLSO_PRAZO_DIAS} dias corridos</b>, contados da data
          do pagamento, pra pedir a devolução de qualquer compra feita na
          plataforma. É o direito de arrependimento previsto no artigo 49 do
          Código de Defesa do Consumidor, e vale pra assinatura e pra pacote de
          créditos.
        </p>
        <p>
          Passados os {REEMBOLSO_PRAZO_DIAS} dias, não há devolução, salvo falha
          nossa na entrega do serviço.
        </p>
      </Secao>

      <Secao titulo="2. A condição do consumo">
        <p>
          O crédito comprado vira processamento real: cada vídeo, imagem, voz ou
          análise gerada tem um custo que pagamos no mesmo instante aos
          provedores de inteligência artificial, e esse custo não volta pra nós.
          Por isso a devolução considera <b>quanto do crédito você já usou</b>.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <b>
              Consumo de até {REEMBOLSO_CONSUMO_MAXIMO_PCT} do crédito da compra:
            </b>{" "}
            devolvemos <b>proporcionalmente ao que você não usou</b>, na forma do
            item 3.
          </li>
          <li>
            <b>
              Consumo acima de {REEMBOLSO_CONSUMO_MAXIMO_PCT} do crédito da
              compra:
            </b>{" "}
            não há devolução. Nesse ponto o serviço já foi essencialmente
            prestado, e o valor residual seria menor do que o custo de processar
            a própria devolução (taxa da processadora e atendimento).
          </li>
        </ul>
        <p>
          O consumo é apurado pelo seu <b>extrato dentro da plataforma</b>, que
          registra cada débito com data, ferramenta e valor. Você pode consultar
          esse extrato a qualquer momento, antes de pedir a devolução.
        </p>
      </Secao>

      <Secao titulo="3. Quanto volta">
        <p>
          A regra é a mesma pra <b>pacote de créditos</b> e pra{" "}
          <b>assinatura</b>: devolvemos a <b>parte proporcional ao crédito que
          você não usou</b>. O valor correspondente ao crédito já consumido não é
          devolvido, porque esse processamento já aconteceu e já foi pago por
          nós.
        </p>
        <p className="rounded-md border bg-muted/40 p-3">
          <b>Exemplo com pacote de créditos.</b> Compra de R$20,00 em créditos.
          Dentro dos {REEMBOLSO_PRAZO_DIAS} dias você usou metade do crédito e
          pediu a devolução: voltam R$10,00, referentes à metade não usada.
        </p>
        <p className="rounded-md border bg-muted/40 p-3">
          <b>Exemplo com assinatura.</b> Você usou 50% do crédito do período:
          voltam 50% do valor pago naquele período. Usou 90%: passou do limite de{" "}
          {REEMBOLSO_CONSUMO_MAXIMO_PCT} e não há devolução do período em curso,
          mas o cancelamento vale normalmente pras cobranças seguintes.
        </p>
        <p>
          Na assinatura, a devolução considera <b>o período em curso</b>. Períodos
          anteriores, já usados e encerrados, não são devolvidos.
        </p>
        <p>
          <b>O crédito comprado não tem prazo de validade</b>, como diz a seção
          Créditos dos{" "}
          <Link href="/termos" className={linkClasse}>
            Termos de Uso
          </Link>
          . O que existe é o prazo de {REEMBOLSO_PRAZO_DIAS} dias pra pedir a
          devolução do dinheiro: passado ele, o crédito continua na sua conta e
          continua podendo ser usado, mas não vira mais dinheiro de volta.
        </p>
      </Secao>

      <Secao titulo="4. O que acontece na sua conta">
        <p>Quando a devolução é concedida:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <b>Assinatura:</b> o acesso à biblioteca e a assinatura caem{" "}
            <b>na hora</b>, junto da devolução. Os créditos de brinde recebidos
            por causa da assinatura (boas-vindas e mensais) são retirados.
            Créditos que você tenha <b>comprado</b> em pacote continuam seus.
          </li>
          <li>
            <b>Pacote de créditos:</b> o crédito não usado daquele pacote é
            retirado do saldo, e sua assinatura não é afetada.
          </li>
          <li>
            <b>Crédito já consumido:</b> se o crédito consumido for maior do que
            o saldo disponível no momento da devolução, a diferença vira{" "}
            <b>saldo devedor</b> e novas gerações ficam bloqueadas até a
            regularização.
          </li>
          <li>
            Sua conta continua existindo e você continua conseguindo entrar, para
            acesso ao histórico e ao que já foi gerado.
          </li>
        </ul>
      </Secao>

      <Secao titulo="5. Prazo e forma da devolução">
        <p>
          A devolução é feita <b>pelo mesmo meio de pagamento</b> usado na
          compra, pela processadora que processou o pedido. O prazo pra o valor
          aparecer depende do meio: em Pix costuma ser de poucos dias úteis, e em
          cartão de crédito o estorno costuma aparecer na fatura seguinte ou na
          subsequente, conforme o fechamento do seu cartão.
        </p>
        <p>
          Analisamos o pedido em até 5 dias úteis contados do recebimento e
          respondemos a você com a decisão e o motivo.
        </p>
      </Secao>

      <Secao titulo="6. Cancelamento sem pedido de devolução">
        <p>
          Cancelar a assinatura e pedir devolução são coisas diferentes. Ao
          cancelar sem pedir devolução, você <b>continua com acesso até o fim do
          período já pago</b> e as cobranças seguintes são interrompidas. Nada é
          retirado da sua conta.
        </p>
      </Secao>

      <Secao titulo="7. Contestação no cartão (chargeback)">
        <p>
          Se você tiver qualquer problema, fale com a gente primeiro: a devolução
          direta é mais rápida do que a contestação no cartão. Abrir contestação
          sem falar com o atendimento faz o acesso à conta ser bloqueado até a
          disputa ser resolvida, conforme os{" "}
          <Link href="/termos" className={linkClasse}>
            Termos de Uso
          </Link>
          . Se a disputa for resolvida a seu favor, aplicam-se as mesmas regras
          de conta do item 4.
        </p>
      </Secao>

      <Secao titulo="8. Como pedir">
        {/* Sem e-mail aqui de propósito (dono, 06/08/2026): o pedido de
            devolução entra pelo WhatsApp ou pela aba Assinatura do painel. */}
        <p>
          Envie o pedido pelo <b>WhatsApp oficial da plataforma</b> ou pela aba{" "}
          <b>Assinatura</b>, dentro do painel, informando:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>o e-mail cadastrado na plataforma;</li>
          <li>a data da compra e o que foi comprado;</li>
          <li>o motivo do pedido (opcional dentro dos {REEMBOLSO_PRAZO_DIAS} dias).</li>
        </ul>
      </Secao>

      <Secao titulo="9. Alterações">
        <p>
          Esta política pode ser atualizada. Vale sempre a versão vigente na data
          da sua compra, e a versão atual está nesta página, com número e data no
          topo.
        </p>
      </Secao>
    </PaginaLegal>
  );
}
