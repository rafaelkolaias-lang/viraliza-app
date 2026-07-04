import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Política de Privacidade | Viraliza",
  description: "Como o Viraliza coleta, usa e protege os seus dados.",
};

const ATUALIZADA_EM = "4 de julho de 2026";

export default function PrivacidadePage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Política de Privacidade</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Última atualização: {ATUALIZADA_EM}
      </p>

      <div className="mt-8 space-y-8 text-sm leading-relaxed">
        <section>
          <h2 className="mb-2 text-lg font-semibold">1. Quem somos</h2>
          <p>
            O <b>Viraliza</b> ("nós") é uma plataforma web de ferramentas de criação de
            conteúdo, incluindo geração de vídeos de produtos, acervo de vídeos e
            ferramentas de marketing. Esta política explica quais dados coletamos,
            por que coletamos e como você pode exercer os seus direitos.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">2. Dados que coletamos</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <b>Dados de cadastro:</b> nome, e-mail e senha (armazenada de forma
              criptografada). Usados pra criar e proteger a sua conta.
            </li>
            <li>
              <b>Dados de pagamento:</b> as compras são processadas pela{" "}
              <b>Kiwify</b> (processadora independente). Recebemos da Kiwify a
              confirmação da compra com nome, e-mail, telefone e valor pago. Nós NÃO
              recebemos nem armazenamos números de cartão.
            </li>
            <li>
              <b>Dados de uso:</b> vídeos gerados, créditos consumidos e histórico de
              transações dentro da plataforma, necessários pro funcionamento do serviço.
            </li>
            <li>
              <b>Atendimento:</b> se você fala com a gente pelo WhatsApp, tratamos as
              mensagens da conversa pra prestar o atendimento.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">3. Como usamos os dados</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Prestar o serviço: login, créditos, geração e entrega de vídeos.</li>
            <li>Processar e confirmar compras e reembolsos feitos na Kiwify.</li>
            <li>Atendimento e suporte (incluindo WhatsApp).</li>
            <li>
              <b>Mensuração de anúncios:</b> quando há uma compra, enviamos à Meta
              (Facebook/Instagram) um evento de conversão com e-mail, telefone e nome{" "}
              <b>criptografados de forma irreversível (hash SHA-256)</b>, pra medir a
              eficácia dos nossos anúncios. A Meta não recebe esses dados em texto puro.
            </li>
            <li>Cumprir obrigações legais e prevenir fraude e abuso.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">4. Com quem compartilhamos</h2>
          <p>
            Não vendemos os seus dados. Compartilhamos apenas com operadores necessários
            ao serviço: <b>Kiwify</b> (pagamentos), <b>Meta</b> (mensuração de anúncios,
            com dados hasheados), provedores de infraestrutura (hospedagem e banco de
            dados) e provedores de IA usados na geração dos vídeos (que recebem o
            conteúdo do vídeo, não os seus dados pessoais).
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">5. Cookies e sessão</h2>
          <p>
            Usamos um cookie de sessão (httpOnly) exclusivamente pra manter você
            logado com segurança. Não usamos cookies de rastreamento de terceiros no
            site.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">6. Retenção e segurança</h2>
          <p>
            Mantemos os dados enquanto a sua conta existir ou enquanto forem necessários
            pra obrigações legais/contábeis. Senhas são armazenadas com hash (bcrypt),
            chaves e segredos ficam cifrados e o acesso aos dados é restrito.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">7. Seus direitos (LGPD)</h2>
          <p>
            Nos termos da Lei Geral de Proteção de Dados (Lei 13.709/2018), você pode
            solicitar: confirmação de tratamento, acesso, correção, anonimização,
            portabilidade e exclusão dos seus dados, além de revogar consentimentos.
            Pra exercer qualquer direito, fale com a gente pelos canais abaixo.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">8. Contato</h2>
          <p>
            Atendimento e privacidade: pelo WhatsApp oficial da plataforma ou pelo
            e-mail <b>oficialonossouniverso@gmail.com</b>.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">9. Alterações</h2>
          <p>
            Esta política pode ser atualizada. A versão vigente estará sempre nesta
            página, com a data de atualização no topo.
          </p>
        </section>
      </div>

      <p className="mt-10 text-sm">
        <Link href="/" className="text-primary underline underline-offset-4">
          Voltar pro início
        </Link>
      </p>
    </main>
  );
}
