import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Política de Reembolso | Viraliza",
  description:
    "Como funciona o reembolso de créditos e o cancelamento da assinatura no Viraliza.",
};

const ATUALIZADA_EM = "6 de agosto de 2026";

/**
 * Política de reembolso, escrita pra ser lida por cliente e não por advogado.
 *
 * Ela precisa existir por dois motivos: a régua de devolução não é 100% em todo
 * caso (o produto é crédito de IA, que vira custo assim que é gasto), e a
 * assinatura não devolve o mês vigente. Deixar isso claro ANTES da compra é o
 * que evita a sensação de pegadinha e, na prática, a disputa no cartão.
 */
export default function ReembolsoPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Política de Reembolso</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Última atualização: {ATUALIZADA_EM}
      </p>

      <div className="mt-8 space-y-8 text-sm leading-relaxed">
        <section>
          <h2 className="mb-2 text-lg font-semibold">Em uma frase</h2>
          <p>
            Você tem <b>7 dias</b> pra pedir reembolso dos créditos que comprou, e
            devolvemos o valor do que você <b>ainda não usou</b>. Não precisa pedir
            pra ninguém: é um botão dentro da sua conta.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">Por que não é sempre 100%</h2>
          <p>
            Crédito no Viraliza não é assinatura de acesso: é combustível. Cada
            crédito gasto vira, no mesmo instante, um vídeo gerado, uma narração
            criada ou um texto escrito, e cada uma dessas coisas tem um custo que a
            gente paga pras empresas de inteligência artificial. Esse custo não
            volta pra nós.
          </p>
          <p className="mt-3">
            Por isso a conta é simples e justa dos dois lados:{" "}
            <b>você paga só pelo que consumiu</b>, e a gente devolve o resto. Não
            existe multa nem taxa escondida.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">Como a gente calcula</h2>
          <p>
            Exemplo com uma compra de <b>R$ 100</b>, que dá 10.000 créditos:
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[420px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="py-2 pr-4 font-semibold">Quanto você usou</th>
                  <th className="py-2 pr-4 font-semibold">Quanto volta</th>
                  <th className="py-2 font-semibold">No exemplo</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr className="border-b border-border/60">
                  <td className="py-2 pr-4">Nada</td>
                  <td className="py-2 pr-4">O valor inteiro</td>
                  <td className="py-2">R$ 100,00</td>
                </tr>
                <tr className="border-b border-border/60">
                  <td className="py-2 pr-4">Até 80% dos créditos</td>
                  <td className="py-2 pr-4">O valor do que sobrou</td>
                  <td className="py-2">usou 3.000 → R$ 70,00</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Mais de 80% dos créditos</td>
                  <td className="py-2 pr-4">O que sobrou, menos 30%</td>
                  <td className="py-2">usou 9.000 → R$ 7,00</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3">
            A tela mostra a conta pronta antes de você confirmar, então você sabe
            exatamente quanto vai receber.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">Como pedir</h2>
          <ol className="ml-5 list-decimal space-y-1">
            <li>
              Entre em <Link href="/painel/creditos" className="underline underline-offset-4">Créditos</Link>, no seu painel.
            </li>
            <li>Na seção "Pedir reembolso", escolha a compra.</li>
            <li>Confira o valor e confirme.</li>
          </ol>
          <p className="mt-3">
            O dinheiro volta pelo mesmo meio que você pagou. No Pix, costuma cair
            em minutos. No cartão, aparece na fatura conforme o prazo do seu banco.
            Os créditos que sobraram saem da sua conta no mesmo momento.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">Assinatura</h2>
          <p>
            A assinatura funciona diferente, porque o que você contrata é o acesso
            do mês: a biblioteca liberada e os créditos de brinde, que entram na sua
            conta assim que o pagamento é aprovado.
          </p>
          <p className="mt-3">
            Você pode <b>cancelar quando quiser</b>, em dois cliques no painel, sem
            multa e sem falar com ninguém. O cancelamento vale para as{" "}
            <b>próximas cobranças</b>: o mês que você já pagou continua valendo até
            o fim, com tudo liberado. Não devolvemos o mês em andamento, porque o
            acesso e os créditos daquele mês já foram entregues.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">O que não é reembolsável</h2>
          <ul className="ml-5 list-disc space-y-1">
            <li>Créditos que já foram usados.</li>
            <li>Compras com mais de 7 dias.</li>
            <li>O mês de assinatura em andamento.</li>
            <li>Créditos recebidos de brinde, promoção ou bônus (não foram pagos).</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">Compras antigas</h2>
          <p>
            Compras feitas antes da mudança do nosso meio de pagamento seguem pelo
            canal em que foram feitas. Se for o seu caso, é só chamar a gente no
            chat de dentro da plataforma que resolvemos.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">Ficou com dúvida?</h2>
          <p>
            Fale com a gente pelo chat dentro da plataforma. A gente responde de
            verdade, e prefere resolver a discutir.
          </p>
        </section>
      </div>

      <div className="mt-10 border-t border-border pt-6 text-sm">
        <Link href="/painel/creditos" className="underline underline-offset-4">
          Voltar para os créditos
        </Link>
      </div>
    </main>
  );
}
