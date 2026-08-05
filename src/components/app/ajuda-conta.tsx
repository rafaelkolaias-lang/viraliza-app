import Link from "next/link";
import {
  Bell,
  Clock,
  Download,
  Flag,
  Gift,
  LayoutGrid,
  MessageSquarePlus,
  Trash2,
  UserRound,
} from "lucide-react";
import {
  Atalho,
  Aviso,
  Cartao,
  Problema,
  Secao,
  Selo,
  Texto,
  Titulinho,
} from "@/components/app/ajuda-blocos";

/**
 * Grupo "Sua conta": onde os vídeos caem, o que dá pra mexer na conta e a
 * seção final de problemas (a mais lida por quem está travado).
 *
 * `linkSuporte` vem da página: é o WhatsApp do suporte, ou a tela de sugestões
 * quando o número ainda não está configurado no ambiente.
 */
export function AjudaConta({
  linkSuporte,
  suporteExterno,
}: {
  linkSuporte: string;
  suporteExterno: boolean;
}) {
  return (
    <>
      {/* ================= MEUS VÍDEOS ================= */}
      <Secao
        id="meus-videos"
        titulo="Meus vídeos e downloads"
        subtitulo="Onde tudo que você gerou vai parar."
      >
        <Texto>
          Não importa por qual ferramenta você passou: todo vídeo termina na tela{" "}
          <strong className="text-foreground">Meus vídeos</strong>, no menu da esquerda.
          Lá você vê o que está pronto, o que ainda está sendo produzido e baixa o
          arquivo.
        </Texto>

        <Titulinho>Os estados de um vídeo</Titulinho>
        <div className="grid gap-3 sm:grid-cols-3">
          <Cartao Icone={Clock} titulo="Em produção">
            Ainda está sendo feito. A página se atualiza sozinha, você não precisa ficar
            apertando F5.
          </Cartao>
          <Cartao Icone={Download} titulo="Pronto">
            Terminou. Clique pra assistir e use o botão de baixar pra salvar no seu
            aparelho.
          </Cartao>
          <Cartao Icone={Trash2} titulo="Erro">
            Alguma coisa falhou no meio. Vídeo com erro{" "}
            <strong className="text-foreground">não é cobrado</strong>.
          </Cartao>
        </div>

        <Aviso tom="dica" titulo="O vídeo saiu ruim? Reporte, não engula o prejuízo">
          Abrindo o vídeo tem o botão{" "}
          <strong className="text-foreground">Reportar problema</strong>. Escreva o que
          deu errado (rosto deformado, fala fora de hora, produto trocado) e mande. A
          gente analisa e devolve os créditos quando o erro foi da plataforma.
        </Aviso>

        <div className="flex flex-wrap gap-3">
          <Selo Icone={Bell}>
            O sininho no topo avisa quando um vídeo fica pronto
          </Selo>
          <Selo Icone={LayoutGrid}>Vídeo excluído por engano? Fale com o suporte</Selo>
        </div>

        <Atalho href="/painel">Abrir Meus vídeos</Atalho>
      </Secao>

      {/* ================= CONTA ================= */}
      <Secao
        id="conta"
        titulo="Conta, senha e indicações"
        subtitulo="O resto do menu, explicado em uma linha cada."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Cartao Icone={UserRound} titulo="Conta">
            Seus dados, o nível, o saldo e a troca de senha. Se você entrou com o Google,
            você não tem senha pra trocar: continue entrando pelo botão do Google.
          </Cartao>
          <Cartao Icone={Gift} titulo="Indique e Ganhe">
            Você se afilia pela Cakto e ganha{" "}
            <strong className="text-foreground">50% de cada venda</strong> que trouxer.
            Tem ranking e prêmio pra quem chega primeiro na meta.
          </Cartao>
          <Cartao Icone={MessageSquarePlus} titulo="Sugestões">
            Pedido de melhoria ou relato de problema. Sugestão boa pode virar crédito de
            recompensa na sua conta.
          </Cartao>
          <Cartao Icone={Bell} titulo="Sininho">
            Avisos da plataforma: vídeo pronto, mudança de nível, resposta do suporte.
          </Cartao>
        </div>

        <Aviso tom="atencao" titulo="Se afiliou e não apareceu no ranking?">
          O ranking casa pelo{" "}
          <strong className="text-foreground">mesmo e-mail</strong> da sua conta aqui.
          Quem se afilia na Cakto usando outro e-mail não aparece na lista. Nesse caso
          fale com o suporte pra ajustar.
        </Aviso>

        <div className="flex flex-wrap gap-2">
          <Atalho href="/painel/conta">Abrir minha conta</Atalho>
          <Link
            href="/painel/indique"
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold transition-colors hover:border-primary/50"
          >
            <Gift className="size-4 text-primary" />
            Indique e Ganhe
          </Link>
        </div>
      </Secao>

      {/* ================= PROBLEMAS ================= */}
      <Secao
        id="problemas"
        titulo="Deu errado? Resolve aqui"
        subtitulo="Os perrengues mais comuns e o que fazer em cada um."
      >
        <Titulinho>Na hora de gerar</Titulinho>
        <div className="space-y-3">
          <Problema pergunta="Cliquei em gerar e parece que travou">
            Não travou. Imagem e vídeo de IA demoram minutos, e o botão fica escrito
            &quot;Criando...&quot; ou &quot;Gerando...&quot; esse tempo todo. Pode fechar
            a aba: o trabalho continua no servidor e o resultado aparece sozinho quando
            terminar.
          </Problema>
          <Problema pergunta="Apareceu que já tenho um vídeo em produção">
            É o limite do seu nível. Conta Bronze produz{" "}
            <strong className="text-foreground">1 vídeo por vez</strong>; Prata, 2; Ouro,
            3. Espere o atual terminar e mande o próximo.
          </Problema>
          <Problema pergunta="Apareceu que eu atingi os vídeos de hoje">
            Também é o nível: Bronze faz 5 por dia, Prata 12 e Ouro 50. O limite renova à
            meia-noite. Bater no teto{" "}
            <strong className="text-foreground">não gasta crédito</strong>.
          </Problema>
          <Problema pergunta="Não tenho créditos suficientes">
            Confira o saldo na aba{" "}
            <Link href="/painel/creditos" className="text-primary hover:underline">
              Créditos
            </Link>
            . Lembre que parte do crédito comprado pode estar reservada pela garantia de
            8 dias. Enquanto isso dá pra usar o que é de graça: influenciadores prontos,
            textos da IA e o gerador de prompt.
          </Problema>
          <Problema pergunta="A conta parou de gerar por causa de saldo pendente">
            Isso acontece quando um reembolso foi feito depois dos créditos já terem sido
            usados. Comprando crédito de novo o pendente é quitado sozinho e a conta
            volta a funcionar.
          </Problema>
        </div>

        <Titulinho>Depois de gerar</Titulinho>
        <div className="space-y-3">
          <Problema pergunta="Saí da tela no meio e não sei se foi cobrado">
            O trabalho continua e o resultado entra na sua lista sozinho. Confira o que
            foi descontado no{" "}
            <Link href="/painel/extrato" className="text-primary hover:underline">
              Extrato
            </Link>
            . Mandar de novo &quot;na dúvida&quot; é o que costuma cobrar duas vezes.
          </Problema>
          <Problema pergunta="O resultado saiu diferente do que eu queria">
            A IA cria uma coisa nova a cada geração, então nunca sai idêntico ao que está
            na sua cabeça. O que mais ajuda é caprichar na descrição (o gerador de
            prompt custa bem pouco) antes de gastar crédito na imagem.
          </Problema>
          <Problema pergunta="O vídeo saiu com defeito de verdade">
            Use o <strong className="text-foreground">Reportar problema</strong> dentro
            do vídeo. Quando o erro é da plataforma, os créditos voltam.
          </Problema>
        </div>

        <Titulinho>Acesso e telas travadas</Titulinho>
        <div className="space-y-3">
          <Problema pergunta="Uma tela da biblioteca apareceu bloqueada">
            Aquelas telas são liberadas pela assinatura. Se ela venceu, elas travam até
            renovar. Veja a situação na aba{" "}
            <Link href="/painel/assinatura" className="text-primary hover:underline">
              Assinatura
            </Link>
            .
          </Problema>
          <Problema pergunta="Não acho uma tela que me falaram">
            No computador o menu fica sempre na esquerda e pode estar recolhido (só
            ícones): clique na setinha pra abrir. No celular, toque nas três listrinhas no
            canto de cima.
          </Problema>
          <Problema pergunta="Esqueci a senha">
            Na tela de login tem o link de recuperar senha. O e-mail chega com um link que
            vale por 30 minutos e só pode ser usado uma vez. Se você criou a conta pelo
            Google, entre pelo botão do Google.
          </Problema>
        </div>

        <Aviso tom="erro" titulo="Nada disso resolveu">
          Chame a gente e conte o que aconteceu, de preferência com a hora que você
          tentou e o nome do vídeo. A gente consegue olhar o seu caso e devolver o
          crédito quando o erro foi nosso.
        </Aviso>

        <a
          href={linkSuporte}
          target={suporteExterno ? "_blank" : undefined}
          rel={suporteExterno ? "noopener noreferrer" : undefined}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 hover:shadow-[0_0_24px_-6px_var(--color-primary)]"
        >
          <Flag className="size-4" />
          Falar com o suporte
        </a>
      </Secao>
    </>
  );
}
