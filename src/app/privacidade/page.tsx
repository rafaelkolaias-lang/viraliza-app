import type { Metadata } from "next";
import Link from "next/link";
import { PaginaLegal, Secao } from "@/components/legal/pagina-legal";
import { EMPRESA, VERSAO_PRIVACIDADE } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Política de Privacidade | Viraliza",
  description: "Como o Viraliza coleta, usa e protege os seus dados.",
};

const linkClasse = "text-primary underline underline-offset-4";

export default function PrivacidadePage() {
  return (
    <PaginaLegal
      titulo="Política de Privacidade"
      versao={VERSAO_PRIVACIDADE}
    >
      <Secao titulo="1. Quem é o controlador dos seus dados">
        <p>
          O <b>{EMPRESA.nome}</b> é uma plataforma web de criação de conteúdo com
          inteligência artificial, operada por <b>{EMPRESA.razaoSocial}</b>,
          CNPJ <b>{EMPRESA.cnpj}</b> (&quot;nós&quot;). Somos o controlador dos
          dados tratados aqui, nos termos da Lei Geral de Proteção de Dados (Lei
          13.709/2018).
        </p>
      </Secao>

      <Secao titulo="2. Dados que coletamos">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <b>Cadastro:</b> nome, e-mail e senha (guardada com hash, nunca em
            texto legível). Se você entra com o Google, recebemos nome, e-mail e
            o identificador da sua conta Google.
          </li>
          <li>
            <b>Pagamento:</b> as compras são processadas por processadoras
            independentes (<b>Cakto</b> e <b>Mercado Pago</b>). Recebemos delas a
            confirmação da compra com nome, e-mail, telefone e valor pago.{" "}
            <b>Não recebemos nem armazenamos número de cartão.</b>
          </li>
          <li>
            <b>Conteúdo que você envia:</b> vídeos, fotos, áudios, textos e
            informações de produto que você sobe pra usar nas ferramentas,
            inclusive <b>imagens de rosto e gravações de voz</b> quando a
            ferramenta escolhida trabalha com isso.
          </li>
          <li>
            <b>Uso da plataforma:</b> conteúdo gerado, créditos consumidos,
            histórico de transações, nível da conta e registros de atividade.
          </li>
          <li>
            <b>Registros de acesso:</b> endereço de rede (IP), data e hora de
            acesso, guardados por 6 meses, como exige o artigo 15 do Marco Civil
            da Internet.
          </li>
          <li>
            <b>Atendimento:</b> as mensagens trocadas com o suporte, no WhatsApp
            ou dentro da plataforma. A conversa com o{" "}
            <b>atendente automático</b> (o balão no canto da tela) fica guardada
            no seu próprio navegador por 24 horas, não no nosso banco de dados.
          </li>
        </ul>
      </Secao>

      <Secao titulo="3. Por que tratamos (base legal)">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <b>Execução do contrato:</b> criar e manter sua conta, processar
            créditos, gerar e entregar o conteúdo que você pediu, dar suporte.
            É a base da maior parte do que fazemos, e não depende de
            consentimento.
          </li>
          <li>
            <b>Obrigação legal:</b> guarda dos registros de acesso, documentos
            fiscais e resposta a autoridades.
          </li>
          <li>
            <b>Legítimo interesse:</b> prevenção a fraude, abuso e estorno
            indevido, segurança da plataforma, controle da fila de produção e
            mensuração de anúncios.
          </li>
          <li>
            <b>Consentimento:</b> usado somente quando pedimos de forma separada
            e específica, por exemplo pra comunicação promocional ou pra usar o
            seu conteúdo como exemplo. Você pode retirar o consentimento a
            qualquer momento, sem prejuízo do serviço contratado.
          </li>
        </ul>
      </Secao>

      <Secao titulo="4. Imagem, rosto e voz">
        <p>
          Algumas ferramentas trabalham com imagem de pessoa e com voz. Sobre
          esse material:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Ele é usado <b>exclusivamente pra executar a geração que você
            pediu</b>.
          </li>
          <li>
            <b>Não usamos o seu rosto, a sua voz nem o seu conteúdo pra treinar
            modelos de inteligência artificial</b>, nossos ou de terceiros, e não
            os usamos como exemplo, propaganda ou material público sem pedir sua
            autorização antes, de forma separada.
          </li>
          <li>
            <b>Não fazemos identificação biométrica:</b> não extraímos nem
            guardamos assinatura facial ou vocal pra reconhecer você ou qualquer
            pessoa.
          </li>
          <li>
            Se você enviar imagem ou voz de outra pessoa, você é responsável por
            ter a autorização dela, conforme os{" "}
            <Link href="/termos" className={linkClasse}>
              Termos de Uso
            </Link>
            .
          </li>
        </ul>
      </Secao>

      <Secao titulo="5. Com quem compartilhamos">
        <p>
          Não vendemos os seus dados. Compartilhamos só com quem é necessário pra
          o serviço funcionar:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <b>Processadoras de pagamento</b> (Cakto e Mercado Pago): dados da
            compra.
          </li>
          <li>
            <b>Provedores de inteligência artificial</b> (hoje <b>Google</b>,{" "}
            <b>xAI</b>, <b>OpenAI</b> e <b>ElevenLabs</b>, além de outros que
            venham a ser usados pelas ferramentas): recebem o conteúdo que você
            mandou processar, como a foto do produto, a imagem do personagem, o
            áudio e o texto do pedido. Eles não recebem os seus dados de cadastro
            e não sabem quem você é.
          </li>
          <li>
            <b>Exceção do atendente automático:</b> pra responder sobre a sua
            conta, o robô do chat manda pro provedor de inteligência artificial o
            seu <b>primeiro nome</b>, o saldo de créditos, a situação da
            assinatura, a quantidade de vídeos prontos e em produção, eventual
            saldo devedor e a tela em que você está. <b>Não</b> mandamos e-mail,
            telefone, senha nem o identificador da sua conta.
          </li>
          <li>
            <b>Infraestrutura</b>: hospedagem, banco de dados e armazenamento dos
            arquivos.
          </li>
          <li>
            <b>Meta</b> (Facebook e Instagram), pra mensuração de anúncios:
            enviamos e-mail, telefone e nome{" "}
            <b>criptografados de forma irreversível (hash SHA-256)</b>. A Meta
            não recebe esses dados em texto legível.
          </li>
          <li>Autoridades públicas, quando houver obrigação legal.</li>
        </ul>
      </Secao>

      <Secao titulo="6. Transferência internacional">
        <p>
          Parte dos provedores acima fica fora do Brasil, principalmente nos
          Estados Unidos. Isso significa que o conteúdo enviado pra
          processamento e alguns dados de conta são{" "}
          <b>transferidos pra outros países</b>. Fazemos essas transferências pra
          executar o contrato com você e escolhendo fornecedores que ofereçam
          proteção compatível com a LGPD, com cláusulas contratuais de proteção
          de dados, conforme os artigos 33 e seguintes da lei.
        </p>
      </Secao>

      <Secao titulo="7. Cookies e sessão">
        <p>
          Usamos um cookie de sessão (httpOnly) exclusivamente pra manter você
          logado com segurança. Não usamos cookies de rastreamento de terceiros
          dentro da plataforma.
        </p>
      </Secao>

      <Secao titulo="8. Por quanto tempo guardamos">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <b>Conta e histórico de uso:</b> enquanto a conta existir.
          </li>
          <li>
            <b>Arquivos enviados pra um trabalho de edição</b> (os vídeos e
            fotos que você sobe pra montar um vídeo): ficam no servidor por{" "}
            <b>até 24 horas</b> depois do trabalho terminar, só pra permitir
            refazer ou ajustar o mesmo vídeo sem subir tudo de novo. Depois disso
            são apagados sozinhos. Excluir o vídeo apaga na hora.
          </li>
          <li>
            <b>O que você salva na plataforma</b> (personagens, cenários,
            imagens e vídeos gerados): enquanto a conta existir ou até você
            apagar dentro da plataforma, o que vier antes.
          </li>
          <li>
            <b>Registros de acesso:</b> 6 meses (Marco Civil da Internet).
          </li>
          <li>
            <b>Dados de compra e fiscais:</b> 5 anos após a transação, por
            obrigação legal e pra defesa em eventual disputa.
          </li>
        </ul>
      </Secao>

      <Secao titulo="9. Seus direitos e como exercer">
        <p>
          Pela LGPD você pode pedir: confirmação de que tratamos seus dados,
          acesso a eles, correção, anonimização, portabilidade, informação sobre
          com quem compartilhamos, revogação de consentimento e{" "}
          <b>exclusão dos seus dados</b>.
        </p>
        <p>
          <b>Exclusão de conta:</b> peça pelos canais abaixo. Apagamos seus dados
          de cadastro, os arquivos enviados e o conteúdo gerado.{" "}
          <b>Continuamos guardando</b> apenas o que a lei nos obriga (registros
          de acesso por 6 meses e dados de compra por 5 anos) e o mínimo
          necessário pra defesa em disputa em andamento.
        </p>
        <p>
          Respondemos em <b>até 15 dias</b> contados do pedido. Se precisarmos de
          mais tempo por complexidade, avisamos você dentro desse prazo.
        </p>
      </Secao>

      <Secao titulo="10. Segurança">
        <p>
          Senhas são guardadas com hash (bcrypt), chaves e segredos ficam
          cifrados, o acesso administrativo é restrito e o tráfego é
          criptografado. Nenhum sistema é impenetrável: se acontecer um incidente
          que possa causar risco relevante a você, comunicaremos você e a
          Autoridade Nacional de Proteção de Dados, como manda a lei.
        </p>
      </Secao>

      <Secao titulo="11. Menores de 18 anos">
        <p>
          A plataforma não é destinada a menores de 18 anos e não coletamos dados
          dessa faixa etária de forma consciente. Se identificarmos uma conta de
          menor, ela será encerrada e os dados apagados. Se você é responsável e
          acredita que isso aconteceu, fale com a gente pelos canais abaixo.
        </p>
      </Secao>

      <Secao titulo="12. Encarregado e contato">
        <p>
          Pedidos sobre dados pessoais, dúvidas de privacidade e contato do
          encarregado (DPO): <b>{EMPRESA.email}</b>, ou o WhatsApp oficial da
          plataforma. Você também pode reclamar diretamente à Autoridade Nacional
          de Proteção de Dados (ANPD).
        </p>
      </Secao>

      <Secao titulo="13. Alterações">
        <p>
          Esta política pode ser atualizada. A versão vigente estará sempre nesta
          página, com número de versão e data no topo. Mudanças relevantes são
          comunicadas dentro da plataforma.
        </p>
      </Secao>
    </PaginaLegal>
  );
}
