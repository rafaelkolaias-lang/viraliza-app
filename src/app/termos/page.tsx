import type { Metadata } from "next";
import Link from "next/link";
import { PaginaLegal, Secao } from "@/components/legal/pagina-legal";
import {
  CREDITO_VALIDADE_DIAS,
  EMPRESA,
  REEMBOLSO_PRAZO_DIAS,
  VERSAO_TERMOS,
} from "@/lib/legal";

export const metadata: Metadata = {
  title: "Termos de Uso | Viraliza",
  description: "As regras de uso da plataforma Viraliza.",
};

const linkClasse = "text-primary underline underline-offset-4";

export default function TermosPage() {
  return (
    <PaginaLegal titulo="Termos de Uso" versao={VERSAO_TERMOS}>
      <p>
        Estes Termos regem o uso do <b>{EMPRESA.nome}</b>, plataforma web de
        criação de conteúdo com inteligência artificial, operada por{" "}
        <b>{EMPRESA.razaoSocial}</b>, inscrita no CNPJ sob o nº{" "}
        <b>{EMPRESA.cnpj}</b>, com endereço em <b>{EMPRESA.endereco}</b>{" "}
        (&quot;nós&quot;, &quot;plataforma&quot;).
      </p>

      <Secao titulo="1. Aceite">
        <p>
          Ao comprar, criar conta ou usar qualquer ferramenta da plataforma, você
          declara que leu e concorda com estes Termos, com a{" "}
          <Link href="/privacidade" className={linkClasse}>
            Política de Privacidade
          </Link>{" "}
          e com a{" "}
          <Link href="/reembolso" className={linkClasse}>
            Política de Reembolso
          </Link>
          . Os três documentos ficam disponíveis no rodapé das telas de acesso e
          no ambiente de compra, antes do pagamento.
        </p>
        <p>
          Se você não concorda com algum ponto, não conclua a compra e não use a
          plataforma.
        </p>
      </Secao>

      <Secao titulo="2. Quem pode usar">
        <p>
          O uso é permitido a maiores de 18 anos com capacidade civil, ou a
          pessoas jurídicas representadas por quem tenha poderes pra isso. Se
          você usa a plataforma em nome de uma empresa, declara ter autorização
          pra aceitar estes Termos por ela.
        </p>
      </Secao>

      <Secao titulo="3. Conta">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            A conta é criada com o mesmo e-mail usado na compra. É por esse
            e-mail que a compra e a conta se encontram, então informar um e-mail
            diferente atrasa a liberação.
          </li>
          <li>
            A conta é <b>pessoal e intransferível</b>. Você é responsável por
            tudo que acontecer nela e por manter a senha em segredo.
          </li>
          <li>
            Compartilhar acesso, revender acesso ou operar várias contas pra
            contornar limites são motivo de suspensão.
          </li>
          <li>
            Os dados informados no cadastro devem ser verdadeiros e atualizados.
          </li>
        </ul>
      </Secao>

      <Secao titulo="4. O que a plataforma entrega">
        <p>
          A plataforma dá acesso a ferramentas de criação (geração e edição de
          vídeo, imagem, voz e texto por inteligência artificial), a uma
          biblioteca de conteúdo e a ferramentas de apoio a marketing. As
          ferramentas disponíveis, seus limites e seus preços em créditos são os
          informados nas telas da plataforma no momento do uso, e podem mudar.
        </p>
        <p>
          Parte das ferramentas depende de serviços de inteligência artificial de
          terceiros. Indisponibilidade, mudança de política ou mudança de preço
          desses serviços pode afetar o que a plataforma consegue entregar.
        </p>
      </Secao>

      <Secao titulo="5. Créditos">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <b>Crédito é unidade de consumo</b>, não é dinheiro. Ele serve pra
            pagar o custo de processamento das ferramentas, não pode ser sacado,
            transferido pra outra conta nem trocado por dinheiro fora das
            hipóteses da Política de Reembolso.
          </li>
          <li>
            O crédito é debitado conforme o consumo real de cada ferramenta, ou
            pelo preço fixo, quando a ferramenta tiver preço fixo anunciado na
            tela.
          </li>
          <li>
            <b>Validade de {CREDITO_VALIDADE_DIAS} dias.</b> Cada pacote de
            crédito comprado vale {CREDITO_VALIDADE_DIAS} dias contados da
            compra. O crédito que sobrar num pacote depois desse prazo expira.
            O consumo sempre sai <b>do pacote mais antigo pro mais novo</b>, pra
            que o crédito mais perto de vencer seja usado primeiro. Avisamos você
            antes de qualquer pacote vencer, e a data de validade de cada um
            aparece na tela de Créditos.
          </li>
          <li>
            <b>Liberação em partes.</b> Por segurança contra fraude, parte do
            crédito comprado pode ser liberada de forma escalonada nos primeiros
            dias, conforme o nível da conta. O saldo total aparece no seu
            extrato, e o que ainda não foi liberado é informado na tela.
          </li>
          <li>
            <b>Saldo devedor.</b> Se um reembolso ou estorno for concedido depois
            de o crédito ter sido consumido, a diferença consumida vira saldo
            devedor, e novas gerações ficam bloqueadas até a regularização.
          </li>
          <li>
            Todo débito e crédito fica registrado no seu extrato dentro da
            plataforma.
          </li>
        </ul>
      </Secao>

      <Secao titulo="6. Assinatura">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            A assinatura é <b>recorrente</b>: ela é cobrada automaticamente a
            cada período, no valor vigente informado no momento da contratação, e{" "}
            <b>continua renovando até você cancelar</b>.
          </li>
          <li>
            A assinatura libera o acesso à biblioteca e concede uma quantidade de
            créditos a cada período, na quantidade vigente informada na plataforma.
          </li>
          <li>
            <b>Cancelamento:</b> pode ser feito a qualquer momento, sem multa,
            pelos canais de atendimento ou pelo ambiente da processadora de
            pagamento. Cancelar interrompe as cobranças seguintes.
          </li>
          <li>
            <b>Cancelamento sem pedido de reembolso:</b> o acesso continua até o
            fim do período que já foi pago.
          </li>
          <li>
            <b>Cancelamento com reembolso concedido:</b> o acesso à biblioteca e
            a assinatura caem <b>imediatamente</b>, junto da devolução.
          </li>
          <li>
            Mudanças de preço não valem retroativamente: você é avisado antes e
            pode cancelar antes da próxima cobrança.
          </li>
        </ul>
      </Secao>

      <Secao titulo="7. Conteúdo que você envia">
        <p>
          Você continua sendo o dono do que envia (vídeos, fotos, áudios, textos
          e informações de produto). Ao enviar, você nos autoriza apenas a
          processar esse material pra executar a ferramenta que você pediu,
          incluindo o envio a provedores de inteligência artificial parceiros,
          conforme a Política de Privacidade.
        </p>
        <p>
          <b>Você garante que tem direito sobre o que envia.</b> Isso vale em
          especial pra rosto, corpo e voz: só envie imagem ou voz de outra pessoa
          se tiver autorização dela. Enviar material de terceiro sem autorização é
          responsabilidade exclusivamente sua, e é motivo de suspensão imediata.
        </p>
      </Secao>

      <Secao titulo="8. Conteúdo gerado por inteligência artificial">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            O conteúdo gerado a partir do seu material é <b>seu</b>, e você pode
            usá-lo comercialmente, respeitando estes Termos e a lei.
          </li>
          <li>
            <b>Inteligência artificial erra.</b> O resultado pode conter
            imprecisão, texto incorreto, distorção de imagem ou semelhança não
            intencional com pessoas, marcas ou obras existentes. Revisar antes de
            publicar é responsabilidade sua.
          </li>
          <li>
            Não garantimos exclusividade: resultados parecidos podem ser gerados
            por outros usuários a partir de pedidos parecidos.
          </li>
          <li>
            A responsabilidade pelo uso, pela publicação e pelas consequências do
            conteúdo gerado é de quem publica.
          </li>
        </ul>
      </Secao>

      <Secao titulo="9. Uso proibido">
        <p>É proibido usar a plataforma pra:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Criar conteúdo sexual, sexualmente explícito ou que envolva menores
            de idade de qualquer forma.
          </li>
          <li>
            Imitar pessoa real sem autorização, inclusive por voz ou rosto, e
            criar conteúdo que faça alguém parecer dizer ou fazer o que não disse
            nem fez.
          </li>
          <li>
            Enganar consumidores: propaganda falsa, promessa de resultado
            inexistente, falso depoimento ou falsa recomendação médica,
            financeira ou jurídica.
          </li>
          <li>
            Violar direito autoral, marca ou direito de imagem de terceiro.
          </li>
          <li>
            Discurso de ódio, ameaça, assédio, incitação à violência ou a
            atividade ilegal.
          </li>
          <li>
            Contornar limites técnicos, automatizar acesso, revender o serviço,
            fazer engenharia reversa ou sobrecarregar a infraestrutura.
          </li>
          <li>Fraudar pagamento, crédito, indicação ou programa de afiliados.</li>
        </ul>
      </Secao>

      <Secao titulo="10. Suspensão e encerramento">
        <p>
          Podemos suspender ou encerrar o acesso, com aviso sempre que possível,
          em caso de descumprimento destes Termos, fraude, estorno indevido ou
          ordem legal. Em caso de <b>chargeback</b> (contestação de pagamento no
          cartão), o acesso pode ser bloqueado até a resolução da disputa.
        </p>
        <p>
          Você pode encerrar sua conta quando quiser, pelos canais de
          atendimento. O encerramento não gera devolução automática: o que vale é
          a{" "}
          <Link href="/reembolso" className={linkClasse}>
            Política de Reembolso
          </Link>
          .
        </p>
      </Secao>

      <Secao titulo="11. Disponibilidade">
        <p>
          Trabalhamos pra manter a plataforma no ar, mas ela pode ficar
          indisponível por manutenção, falha técnica ou problema em serviço de
          terceiro. Não garantimos funcionamento ininterrupto nem ausência de
          erros. Ferramentas podem ser alteradas, substituídas ou descontinuadas,
          com aviso prévio quando a mudança afetar o que você já contratou.
        </p>
      </Secao>

      <Secao titulo="12. Pagamentos">
        <p>
          As compras são processadas por processadoras de pagamento
          independentes. Os dados do seu cartão são tratados por elas: nós não
          recebemos nem armazenamos número de cartão. Prazos de liberação,
          antifraude e formas de pagamento seguem as regras da processadora
          escolhida no checkout.
        </p>
        <p>
          O direito de arrependimento de {REEMBOLSO_PRAZO_DIAS} dias e as demais
          regras de devolução estão na{" "}
          <Link href="/reembolso" className={linkClasse}>
            Política de Reembolso
          </Link>
          , que é parte integrante destes Termos.
        </p>
      </Secao>

      <Secao titulo="13. Limitação de responsabilidade">
        <p>
          Nos limites permitidos pela legislação consumerista, não respondemos
          por lucros cessantes, perda de oportunidade, resultado comercial obtido
          (ou não obtido) com o conteúdo gerado, nem por decisões que você tome
          com base nele. Nada nesta cláusula afasta os direitos que o Código de
          Defesa do Consumidor garante a você.
        </p>
      </Secao>

      <Secao titulo="14. Alterações destes Termos">
        <p>
          Estes Termos podem ser atualizados. A versão vigente estará sempre
          nesta página, com número de versão e data no topo. Mudanças que
          reduzam direitos seus ou aumentem suas obrigações serão comunicadas
          com antecedência, e você poderá cancelar antes que passem a valer.
        </p>
      </Secao>

      <Secao titulo="15. Lei aplicável e foro">
        <p>
          Estes Termos são regidos pela lei brasileira. Fica eleito o foro do
          domicílio do consumidor pra resolver qualquer questão decorrente
          deles, sem prejuízo de outras vias legais.
        </p>
      </Secao>

      <Secao titulo="16. Contato">
        <p>
          Dúvidas, pedidos e reclamações: <b>{EMPRESA.email}</b> ou o WhatsApp
          oficial da plataforma.
        </p>
      </Secao>
    </PaginaLegal>
  );
}
