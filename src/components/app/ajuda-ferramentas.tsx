import {
  BookOpen,
  Coins,
  Crown,
  Download,
  Film,
  Image as ImageIcon,
  MapPin,
  Music2,
  Pickaxe,
  Search,
  ShoppingBag,
  Stamp,
  Upload,
} from "lucide-react";
import {
  Atalho,
  Aviso,
  Cartao,
  Passo,
  Problema,
  Secao,
  Selo,
  Texto,
  Titulinho,
} from "@/components/app/ajuda-blocos";
import { CREDITOS_FIXO } from "@/lib/precos";

/**
 * Grupo "Outras ferramentas": o que existe fora da geração de vídeo por IA.
 * Lote e MapsLeads têm preço fixo (não usam IA); a biblioteca inteira depende
 * da assinatura estar em dia.
 *
 * Os preços NÃO são escritos na mão aqui: saem de `CREDITOS_FIXO`, senão mexer
 * na tabela deixava a ajuda mentindo pro usuário.
 */
export function AjudaFerramentas() {
  return (
    <>
      {/* ================= LOTE ================= */}
      <Secao
        id="lote"
        titulo="Aplicar marca em lote"
        subtitulo="Carimba a sua logo ou moldura em vários vídeos de uma vez."
      >
        <Texto>
          Serve pra pegar um monte de vídeo e deixar todos com a sua cara, sem abrir
          editor nenhum. Dá pra mandar até{" "}
          <strong className="text-foreground">12 vídeos por vez</strong>.
        </Texto>

        <div className="space-y-4">
          <Passo n={1} titulo="Junte os vídeos" Icone={Upload}>
            Você pode enviar do seu computador ou pegar direto da plataforma, pelo botão
            que abre o acervo de cortes e os virais.
          </Passo>
          <Passo n={2} titulo="Escolha a marca" Icone={Stamp}>
            Pode ser uma moldura, uma logo, a marca que você já salvou antes ou uma
            imagem nova sua. A tela mostra exemplos prontos pra você ver como fica.
          </Passo>
          <Passo n={3} titulo="Posicione" Icone={ImageIcon}>
            Arraste pra escolher o canto e ajuste o tamanho. Também dá pra deixar o vídeo
            mudo, se quiser.
          </Passo>
        </div>

        <div className="flex flex-wrap gap-3">
          <Selo Icone={Coins}>
            Custa{" "}
            <strong className="text-foreground">
              {CREDITOS_FIXO.lote} créditos por vídeo
            </strong>{" "}
            carimbado
          </Selo>
          <Selo Icone={Film}>Cada vídeo vira um item separado em Meus vídeos</Selo>
        </div>

        <Aviso tom="atencao" titulo="Mandou 12 vídeos? São 12 cobranças">
          O preço é por vídeo, não por lote. Mandar 12 de uma vez custa 12 vezes o valor
          de um. Confira a lista antes de confirmar.
        </Aviso>

        <Atalho href="/painel/lote">Abrir o Aplicar marca em lote</Atalho>
      </Secao>

      {/* ================= MAPSLEADS ================= */}
      <Secao
        id="leads"
        titulo="MapsLeads"
        subtitulo="Lista de empresas com telefone, por ramo e por cidade."
      >
        <Texto>
          Nada a ver com vídeo: essa ferramenta acha empresas de um ramo específico numa
          cidade e devolve os contatos, pra quem vende serviço ou quer prospectar.
        </Texto>

        <div className="space-y-4">
          <Passo n={1} titulo="Escolha o ramo" Icone={Search}>
            Marque um ou mais nichos na lista (restaurante, academia, pet shop, etc.).
          </Passo>
          <Passo n={2} titulo="Diga onde" Icone={MapPin}>
            Cidade e estado. Sem isso a busca não sai.
          </Passo>
          <Passo n={3} titulo="Quantos contatos" Icone={Download}>
            De 10 até 200 por busca. Depois dá pra filtrar por quentes e mornos, e baixar
            a lista.
          </Passo>
        </div>

        <div className="flex flex-wrap gap-3">
          <Selo Icone={Coins}>
            Custa{" "}
            <strong className="text-foreground">
              {CREDITOS_FIXO.leads} créditos por busca
            </strong>
          </Selo>
          <Selo Icone={Search}>Busca que não acha ninguém não cobra nada</Selo>
        </div>

        <Atalho href="/painel/leads">Abrir o MapsLeads</Atalho>
      </Secao>

      {/* ================= BIBLIOTECA ================= */}
      <Secao
        id="biblioteca"
        titulo="Minerador e biblioteca"
        subtitulo="O conteúdo pronto que vem junto com a assinatura."
      >
        <Aviso tom="atencao" titulo="Tudo desta seção depende da assinatura em dia">
          Se a sua assinatura vencer, essas telas travam e aparece um aviso pedindo pra
          renovar. Seus créditos continuam valendo normalmente, e o que já é seu (vídeos
          e influenciadores) não some.
        </Aviso>

        <div className="grid gap-3 sm:grid-cols-2">
          <Cartao Icone={Pickaxe} titulo="Minerador">
            Você escreve o nicho que quer (por exemplo &quot;produtos pra quem tem
            pet&quot;) e ele garimpa os vídeos que mais vendem naquele assunto. É o
            atalho pra descobrir o que anunciar.
          </Cartao>
          <Cartao Icone={Film} titulo="Acervo de cortes">
            Biblioteca de cortes prontos pra você usar no editor ou carimbar sua marca.
          </Cartao>
          <Cartao Icone={ShoppingBag} titulo="Shopee">
            Produtos e vídeos da Shopee, com os campeões de venda.
          </Cartao>
          <Cartao Icone={Music2} titulo="Produtos TikTok">
            A mesma ideia, com o que está vendendo no TikTok Shop.
          </Cartao>
          <Cartao Icone={BookOpen} titulo="Área do membro">
            Materiais e e-books liberados pra quem assina.
          </Cartao>
          <Cartao Icone={Crown} titulo="Vídeos virais">
            Os virais que a plataforma coleta, pra você se inspirar ou reaproveitar.
          </Cartao>
        </div>

        <Titulinho>O jeito certo de usar isso tudo junto</Titulinho>
        <Texto>
          O caminho que mais funciona é: achar o produto no Minerador ou na Shopee, pegar
          a foto dele, levar pro Viraliza Labs e gerar o criativo com o seu influenciador.
          A biblioteca serve pra você não ficar parado sem saber o que anunciar.
        </Texto>

        <Problema pergunta="Entrei numa dessas telas e ela apareceu bloqueada">
          Quer dizer que a assinatura está vencida ou que a conta nunca teve assinatura.
          O próprio aviso mostra o caminho pra regularizar, e assim que a assinatura
          volta a valer as telas destravam sozinhas.
        </Problema>

        <Atalho href="/painel/minerador">Abrir o Minerador</Atalho>
      </Secao>
    </>
  );
}
