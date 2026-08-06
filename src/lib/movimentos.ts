/**
 * Biblioteca de MOVIMENTOS do Viraliza Lab: como a pessoa (e a câmera) se mexem
 * no vídeo. Cada item tem um vídeo curto de exemplo (media/lab/movimentos) e a
 * direção que entra no prompt do Grok.
 *
 * É OPCIONAL: sem movimento o vídeo sai normal, com a animação que a IA decidir.
 * Client-safe (a tela importa direto).
 *
 * ============================================================================
 * REESCRITA EM 06/ago/2026: só entra aqui movimento VALIDADO.
 * ============================================================================
 *
 * Os 27 antigos saíram. A regra agora é: um movimento só existe nessa lista
 * depois que o vídeo de exemplo dele foi gerado e assistido. Se o vídeo bugou,
 * o movimento não entra (foi o caso do "selfie-reagir"). Os prompts de cada
 * grupo, validados ou não, ficam em docs/prompts-exemplos-movimento.md.
 *
 * Grupos: selfie ✅ · pov · espelho · vestindo · de frente · câmera
 *
 * Duas mudanças que vieram de vídeo quebrado de verdade:
 *
 * 1. ORÇAMENTO DE MÃOS EM TODO MOVIMENTO. O bug do "braço extra" não vinha de
 *    falta de regra anatômica (ela já existia): vinha de o movimento pedir mais
 *    ações simultâneas do que mãos disponíveis. O exemplo campeão era
 *    "segura o celular E aponta pro produto com a mão livre" — nessa conta
 *    sobra o produto sem ninguém pra segurar, e o modelo inventa um terceiro
 *    braço pra fechar a lógica. Agora cada direção diz O QUE CADA MÃO FAZ, e o
 *    orçamento muda por estilo:
 *      - POV e de frente: as DUAS mãos livres pro produto;
 *      - selfie e espelho: UMA mão já segura o celular, então sobra UMA só;
 *      - vestindo: o produto é a roupa, então as mãos ficam livres e vazias;
 *      - câmera: não existe pessoa nenhuma em cena.
 *
 * 2. DIREÇÃO EM PORTUGUÊS. As direções eram em inglês dentro de um prompt em
 *    pt-BR. O Grok obedece bem melhor quando o pedido inteiro fala uma língua
 *    só (mesma lição que já tinha aparecido na fala saindo em inglês do nada).
 *
 * Regra de ouro pra escrever movimento novo: UMA ação por vez, com as mãos
 * contadas. Se a frase precisa de um "e" pra somar outra ação, provavelmente
 * ela vai virar braço extra.
 */

export type CategoriaMovimento =
  | "movimentos"
  | "selfie"
  | "espelho"
  | "pov"
  | "camera";

export type Movimento = {
  chave: string;
  label: string;
  descricao: string; // o que a pessoa lê
  categoria: CategoriaMovimento;
  /** direção que entra no prompt (pt-BR, com o orçamento de mãos fechado) */
  direcao: string;
  /** estilos de câmera em que esse movimento faz sentido (vazio = todos) */
  estilos?: string[];
};

// Sem "Todos" de propósito: com muitos vídeos rodando ao mesmo tempo a tela
// fica pesada no celular. Sempre mostra uma categoria por vez.
export const CATEGORIAS_MOVIMENTO: { chave: CategoriaMovimento; label: string }[] = [
  { chave: "movimentos", label: "Movimentos" },
  { chave: "selfie", label: "Selfie" },
  { chave: "espelho", label: "No espelho" },
  { chave: "pov", label: "POV (mãos)" },
  { chave: "camera", label: "Câmera" },
];

/**
 * Trecho repetido em todo movimento: uma ação por clipe.
 *
 * Encurtado em 06/ago junto com a reescrita do prompt. Ele diz respeito à
 * OPERAÇÃO (não troque de gesto), não a um objeto visível, então é uma das
 * poucas restrições que sobrevivem à regra de "nada de negativa".
 */
const UMA_ACAO = "Só esse movimento, do começo ao fim do vídeo.";

export const MOVIMENTOS: Movimento[] = [
  // ==========================================================================
  // SELFIE — UMA das mãos segura o celular (fora do quadro). SOBRA UMA SÓ.
  //
  // Aqui nascia o braço extra. Repare como as direções mudaram depois do teste
  // A/B: em vez de CONTAR mãos ("sobra UMA ÚNICA mão", "nenhuma terceira mão
  // existe"), elas ANCORAM cada mão num lugar e num objeto. Contar planta a
  // palavra "mão" várias vezes num motor que não tem campo de negativa; ancorar
  // simplesmente não deixa vaga pra mão nova aparecer.
  // ==========================================================================
  {
    chave: "selfie-mostrar",
    label: "Mostrando na selfie",
    descricao: "Ela levanta o produto ao lado do rosto.",
    categoria: "selfie",
    estilos: ["selfie"],
    direcao:
      "A mão livre dela segura o produto e o levanta devagar até a altura dos olhos, virando a frente dele pra câmera; a outra mão segura o celular, fora do quadro. " +
      UMA_ACAO,
  },
  {
    chave: "selfie-aproximar",
    label: "Chegando perto na selfie",
    descricao: "Ela traz o produto para perto da câmera.",
    categoria: "selfie",
    estilos: ["selfie"],
    direcao:
      "A mão livre dela segura o produto e o traz devagar em direção à câmera, até ele ficar bem visível ao lado do rosto; a outra mão segura o celular, fora do quadro. " +
      UMA_ACAO,
  },
  // Aqui era "selfie-reagir" (só olhar e expressão) e saiu horrível: sem
  // movimento de corpo o modelo entrega foto tremida ou inventa gesto pra
  // preencher os segundos. Trocado por "andando", que é o movimento mais nativo
  // do TikTok e tem movimento de sobra, o oposto do problema.
  {
    chave: "selfie-andando",
    label: "Andando com o produto",
    descricao: "Ela caminha em direção à câmera mostrando o produto.",
    categoria: "selfie",
    estilos: ["selfie"],
    direcao:
      "Ela caminha devagar em direção à câmera enquanto se filma, com o produto na mão livre ao lado do rosto e o corpo balançando no ritmo do passo; a outra mão segura o celular, fora do quadro. Ela olha pra lente o tempo todo. " +
      UMA_ACAO,
  },

  // ==========================================================================
  // ESPELHO — uma das mãos segura o celular, e ele APARECE no reflexo.
  // O risco próprio daqui é o reflexo duplicar a pessoa, então cada direção
  // afirma que o reflexo mostra a mesma pessoa da foto.
  // ==========================================================================
  {
    chave: "espelho-textura",
    label: "Mostrando o tecido",
    descricao: "Ela passa a mão pelo tecido, do peito até a barra.",
    categoria: "espelho",
    estilos: ["espelho"],
    direcao:
      "Diante do espelho, a mão livre dela desce pelo tecido da roupa, do peito até a barra, com os dedos correndo por cima do pano; a outra mão segura o celular na altura do peito, visível no reflexo. O reflexo mostra a mesma pessoa da foto. Enquadramento de corpo inteiro. " +
      UMA_ACAO,
  },
  {
    chave: "espelho-confianca",
    label: "Pose confiante",
    descricao: "Ela gira o corpo devagar diante do espelho.",
    categoria: "espelho",
    estilos: ["espelho"],
    direcao:
      "Diante do espelho, ela gira o corpo devagar pro lado e volta, com o rosto virado pro próprio reflexo; uma das mãos segura o celular na altura do peito, visível no reflexo, e a outra está apoiada na cintura desde o primeiro quadro. O reflexo mostra a mesma pessoa da foto. Enquadramento de corpo inteiro. " +
      UMA_ACAO,
  },

  // ==========================================================================
  // POV — só as mãos e o produto em quadro. AS DUAS MÃOS ESTÃO LIVRES.
  // ==========================================================================
  {
    chave: "pov-produto-maos",
    label: "Girando o produto",
    descricao: "As mãos giram o produto, da frente até o perfil.",
    categoria: "pov",
    estilos: ["maos"],
    direcao:
      "Em quadro aparecem só as mãos e o produto. Uma mão segura o produto pela base e a outra pela lateral, e juntas elas giram ele devagar, da frente até o perfil, e param ali. " +
      UMA_ACAO,
  },
  {
    chave: "pov-unboxing",
    label: "Unboxing",
    descricao: "Uma mão segura a embalagem, a outra abre e revela.",
    categoria: "pov",
    estilos: ["maos"],
    direcao:
      "Em quadro aparecem só as mãos, a embalagem e o produto. A mão esquerda segura a embalagem firme e apoiada, e a mão direita levanta a tampa devagar até o produto de dentro ficar à mostra, terminando com a tampa ainda presa nos dedos. " +
      UMA_ACAO,
  },
  {
    chave: "pov-capinha",
    label: "Inclinando na luz",
    descricao: "As mãos inclinam o produto e a luz corre na superfície.",
    categoria: "pov",
    estilos: ["maos"],
    direcao:
      "Em quadro aparecem só as mãos e o produto. As duas mãos seguram o produto virado pra câmera e inclinam ele pro lado num movimento curto de pulso, até o brilho correr pela superfície, e param nessa posição. A luz do ambiente continua a mesma. " +
      UMA_ACAO,
  },
  {
    chave: "pov-sapatos",
    label: "Olhando pros pés",
    descricao: "O olhar desce pros próprios pés e ela dá um passo.",
    categoria: "pov",
    estilos: ["maos"],
    direcao:
      "O quadro é o olhar da própria pessoa pra baixo: aparecem as pernas e os pés calçando o produto, no chão. Ela dá um passo calmo pra frente e para, com o pé de trás entrando no quadro no fim. Os braços dela ficam soltos ao lado do corpo, fora do quadro. " +
      UMA_ACAO,
  },

  // ==========================================================================
  // CÂMERA — a foto não tem ninguém, nem uma mão. Quem se move é a câmera.
  //
  // As duas direções antigas falavam em "the subject shifts weight" e "the
  // outfit details", ou seja, pediam uma pessoa que não existe na cena. Isso
  // não é gesto malfeito: é ordem pro modelo inventar gente do nada.
  // ==========================================================================
  {
    chave: "push-in-peso",
    label: "Aproximação lenta",
    descricao: "A câmera vai chegando devagar até o produto.",
    categoria: "camera",
    direcao:
      "O produto fica parado onde está e só a câmera se move, numa aproximação lenta e contínua, até ele ocupar cerca de metade do quadro. O cenário ao redor continua o mesmo. " +
      UMA_ACAO,
  },
  {
    chave: "pan-zoom",
    label: "Deslizando de lado",
    descricao: "A câmera desliza de lado revelando o produto.",
    categoria: "camera",
    direcao:
      "O produto fica parado no lugar e só a câmera se move, deslizando devagar da esquerda pra direita, até ele ficar centralizado no quadro. A distância da câmera até o produto continua a mesma. " +
      UMA_ACAO,
  },

  // ==========================================================================
  // CORPO — pessoa em cena. O orçamento muda com o estilo:
  //   de_frente = as duas mãos ocupadas com o produto;
  //   vestindo  = o produto é a roupa, então as mãos estão vazias.
  //
  // Os dois movimentos universais (virada de cabeça e troca de peso) resolvem
  // isso sem escrever duas versões: em vez de dizer o que as mãos fazem, eles
  // dizem que as mãos CONTINUAM ONDE JÁ ESTAVAM. Custo zero de mãos, serve os
  // dois estilos, e não abre vaga pra mão nova aparecer.
  // ==========================================================================
  {
    chave: "revelacao",
    label: "Revelação",
    descricao: "Ela levanta o produto e o olhar sobe junto.",
    categoria: "movimentos",
    estilos: ["de_frente"],
    direcao:
      "As duas mãos dela seguram o produto na altura da cintura e o levantam até a altura do peito, com a frente dele virada pra câmera, e o olhar sobe junto com o produto até voltar pra lente. O corpo fica plantado no lugar. " +
      UMA_ACAO,
  },
  {
    chave: "destaque-tecido",
    label: "Mostrando o tecido",
    descricao: "Ela estica o tecido pra mostrar o material.",
    categoria: "movimentos",
    estilos: ["vestindo"],
    direcao:
      "Uma das mãos dela pinça o tecido da roupa na altura do quadril, entre o polegar e o indicador, e puxa alguns centímetros pra fora do corpo, deixando o material esticado e visível pra câmera, e segura assim até o fim. A outra mão fica solta ao lado do corpo. " +
      UMA_ACAO,
  },
  {
    chave: "ajusta-acessorio",
    label: "Ajeitando o acessório",
    descricao: "Ela ajeita os óculos, o boné ou o relógio no lugar.",
    categoria: "movimentos",
    estilos: ["vestindo"],
    direcao:
      "Uma das mãos dela sobe até o acessório que ela já está usando, encosta na borda com o polegar e o indicador e o empurra um pouco pra cima, ajeitando no lugar, e desce de volta pro lado do corpo. A outra mão fica solta ao lado do corpo. Ela olha pra câmera. " +
      UMA_ACAO,
  },
  {
    chave: "virada-cabeca",
    label: "Virada de cabeça",
    descricao: "Ela vira o rosto do lado até encarar a câmera.",
    categoria: "movimentos",
    direcao:
      "Ela começa com o rosto virado de lado e gira a cabeça devagar até ficar de frente pra lente, com o olhar chegando junto no fim do giro e o cabelo acompanhando o movimento. As mãos continuam onde já estavam na foto, paradas. O corpo fica plantado no lugar. " +
      UMA_ACAO,
  },
  {
    // A chave continua "assimetrico" porque é o nome do arquivo de vídeo no
    // serverrk. O que muda é o label: "Movimento natural" não dizia nada, e o
    // prompt antigo ("one side leads subtly") era um convite pro modelo mover
    // um lado do corpo sozinho, que é como o braço extra aparece.
    chave: "assimetrico",
    label: "Trocando o peso",
    descricao: "O corpo se acomoda, o peso passa de uma perna pra outra.",
    categoria: "movimentos",
    direcao:
      "O peso do corpo dela passa devagar de uma perna pra outra: o quadril desloca pro lado, um ombro desce e o outro sobe junto, e o corpo assenta na nova posição e fica ali. As mãos continuam onde já estavam na foto. Ela olha pra câmera. " +
      UMA_ACAO,
  },
  {
    chave: "arruma-cabelo",
    label: "Passando a mão no cabelo",
    descricao: "Ela joga a mecha pra trás do ombro.",
    categoria: "movimentos",
    estilos: ["vestindo"],
    direcao:
      "Uma das mãos dela sobe até a lateral do rosto, os dedos entram no cabelo e jogam a mecha pra trás do ombro, e o cabelo balança e assenta sozinho depois. A outra mão fica solta ao lado do corpo. Ela olha pra câmera durante o gesto. " +
      UMA_ACAO,
  },
];

export function movimentoPorChave(chave?: string | null) {
  return MOVIMENTOS.find((m) => m.chave === chave) ?? null;
}

/**
 * O que a imagem base aguarda animar. É o corte que importa: o motor ANIMA a
 * foto, então movimento de POV numa foto com a pessoa de frente ou faz o modelo
 * ignorar, ou pior, recriar a cena e trocar o rosto.
 *
 *  - imagem POV (só as mãos): SÓ os movimentos de POV;
 *  - produto parado na bancada (sem mão nenhuma): só os de câmera;
 *  - com pessoa: tudo, menos os de POV (não tem POV com o rosto no quadro).
 */
export type CenaDaImagem = { temPessoa: boolean; temMaos: boolean };

export function movimentosDaCena(cena: CenaDaImagem): Movimento[] {
  if (!cena.temPessoa) {
    const cat: CategoriaMovimento = cena.temMaos ? "pov" : "camera";
    return MOVIMENTOS.filter((m) => m.categoria === cat);
  }
  return MOVIMENTOS.filter((m) => m.categoria !== "pov");
}

/**
 * O movimento escolhido continua valendo pra essa cena? Devolve o próprio
 * movimento válido ou null, e null só significa "anima sem movimento pedido".
 */
export function movimentoCompativel(
  chave: string | null | undefined,
  cena: CenaDaImagem,
  estilo?: string | null,
): Movimento | null {
  const m = movimentoPorChave(chave);
  if (!m) return null;
  return movimentosParaEstilo(estilo, cena).some((d) => d.chave === m.chave) ? m : null;
}

/** Categorias que sobram pra essa cena e esse estilo (ordem da barra de filtros). */
export function categoriasDaCena(cena: CenaDaImagem, estilo?: string | null) {
  const disponiveis = new Set(movimentosParaEstilo(estilo, cena).map((m) => m.categoria));
  return CATEGORIAS_MOVIMENTO.filter((c) => disponiveis.has(c.chave));
}

/**
 * Os movimentos que fazem sentido pra essa cena E pra esse estilo de câmera.
 *
 * ATENÇÃO, isso aqui é uma correção de bug: até 06/ago essa função só REORDENAVA
 * (devolvia `[...combinam, ...resto]`), então o movimento incompatível continuava
 * na grade, só que mais embaixo, e continuava clicável. Na prática dava pra estar
 * no estilo "de frente" (as duas mãos ocupadas com o produto) e escolher
 * "passando a mão no cabelo", que precisa de uma terceira mão. Todo o cuidado de
 * ancorar as mãos nas direções não vale nada se a tela deixa somar duas
 * coreografias que brigam entre si.
 *
 * Movimento sem `estilos` é universal e passa em qualquer estilo.
 */
export function movimentosParaEstilo(
  estilo: string | null | undefined,
  cena: CenaDaImagem,
): Movimento[] {
  const lista = movimentosDaCena(cena);
  if (!estilo) return lista;
  return lista.filter((m) => !m.estilos || m.estilos.includes(estilo));
}
