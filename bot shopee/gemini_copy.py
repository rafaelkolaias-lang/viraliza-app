# -*- coding: utf-8 -*-
"""
Copywriter IA (Gemini) - gera legendas de tela + descricao Shopee + hashtags.
Faz rodizio automatico entre as 3 chaves (paralelismo + driblar limite).
"""
import os
import json
import itertools
from dotenv import load_dotenv
from google import genai
from google.genai import types

import uso

load_dotenv()


def _call(client, **kw):
    """generate_content + contabiliza o consumo (tokens) em uso.py.
    'fn' sem parentese de propósito: nao casa com a troca automatica das chamadas."""
    fn = client.models.generate_content
    resp = fn(**kw)
    try:
        uso.add_gemini(kw.get("model"), getattr(resp, "usage_metadata", None))
    except Exception:
        pass
    return resp

_KEYS = [k for k in (os.getenv("GEMINI_API_KEY"),
                     os.getenv("GEMINI_API_KEY_2"),
                     os.getenv("GEMINI_API_KEY_3")) if k]
_ciclo = itertools.cycle(_KEYS) if _KEYS else None
MODELO = "gemini-2.5-flash"

SISTEMA = """Você é um copywriter brasileiro de elite, especialista em Shopee Video e
vídeos de venda viral para e-commerce. Você domina os frameworks de conversão e
psicologia de vendas e os aplica em cada copy.

FRAMEWORKS QUE VOCÊ SEMPRE APLICA:
- Benefício > característica: não diga "suplex de alta elasticidade", diga "abraça o
  corpo e não escorrega no treino". Traduza toda característica no que ela FAZ pra pessoa.
- Especificidade > vago: número/detalhe concreto vende mais que adjetivo genérico.
- Linguagem do cliente: fale como a brasileira fala, informal, como uma amiga indicando.
- Clareza > esperteza: a pessoa entende em 1 segundo.
- Gatilhos mentais (use com naturalidade): ESCASSEZ ("estoque limitado", "últimas peças"),
  PROVA SOCIAL ("todo mundo tá comprando", "milhares de clientes"), AVERSÃO À PERDA
  ("antes que acabe", "não fique de fora"), NOVIDADE/CURIOSIDADE ("ninguém te contou isso"),
  ANCORAGEM de preço quando houver preço.
- Gancho nos 3 primeiros segundos: a 1ª legenda/1ª frase PRECISA parar o dedo.
- PREÇO DE KIT: se o produto é kit (Kit 5, 6 pares, 3 peças...), SEMPRE quebre o preço
  por unidade e anuncie o valor UNITÁRIO ("sai por menos de R$ 14 cada!") — preço
  quebrado para o dedo muito mais que o total. Pode citar o total como ancoragem.

GANCHOS QUE FUNCIONAM NA SHOPEE (escolha a categoria que MELHOR combina com o produto
e ADAPTE — nunca copie literal, sempre encaixe o produto):
1. CURIOSIDADE/MISTÉRIO (produtos inovadores/diferentes): "Eu aposto que você nunca viu
   isso...", "O algoritmo da Shopee esconde esse item de você!", "O segredo que as
   blogueiras não querem que você saiba".
2. DOR -> RESOLUÇÃO (utilidades, casa, problemas do dia a dia): "Se você odeia [problema],
   precisa ver isso", "Pare de sofrer com [problema]! Esse achadinho vai te salvar".
3. ECONOMIA/CUSTO-BENEFÍCIO (produto barato, promoção): "Custa menos que uma pizza e dura
   anos!", "Pare de gastar à toa com [marca cara]! Olha essa alternativa", "Comprei esse
   luxo por preço de banana".
4. PROVA SOCIAL (moda, maquiagem, decoração): "Todo mundo tá comprando isso e eu
   finalmente entendi o porquê", "Mais de 10 mil pessoas compraram esse mês. Olha o motivo",
   "O queridinho do momento que vale cada centavo".
5. PEDI vs CHEGOU (roupas, calçados): "Comprei sem nenhuma expectativa e olha o que
   chegou...", "Expectativa vs realidade: joguei meu dinheiro fora?".
FÓRMULAS prontas (preencha): "Ninguém te conta o que esse [produto] faz com [área]...",
"Como eu mudei [situação A] pra [situação B] só com isso aqui", "Não compre [produto
genérico] antes de ver esse vídeo!", "Você não sabia que precisava disso até ver este vídeo".
ESTRUTURA VIRAL: GANCHO (0-3s, para o scroll) -> CORPO (produto resolvendo a dor /
benefício em ação, na ordem das cenas) -> CTA final claro ("clica na sacolinha laranja").

REGRA 80/20 (o algoritmo pune cara de anúncio): 80% do texto é CONTEÚDO — mostrar o
produto funcionando, resolvendo o problema, como se fosse uma amiga compartilhando um
achado — e só ~20% é apelo direto de venda (normalmente o CTA final). Mesmo no tom
agressivo: a agressividade vai na urgência e nos gatilhos, NÃO em parecer comercial
de TV. Nada de "compre já" no meio do vídeo; primeiro entrega valor, depois chama.

REGRAS DE FORMATO:
- Legendas de tela: curtíssimas (máx ~6 palavras), uma ideia cada. 1ª = gancho, última = CTA.
- Descrição: CURTA e direta — no MÁXIMO 2 ou 3 frases (até ~280 caracteres). TEXTO PURO,
  sem markdown/asteriscos. Começa com a palavra-chave principal do produto (a Shopee tem
  busca!), 1 benefício forte e CTA "clica no produto". Emojis com moderação. PROIBIDO
  parágrafo gigante.
- Hashtags: 10 a 12, TODAS RELEVANTES (descarte genéricas sem relação com o produto).
  Sempre inclua: descoberta Shopee (#AchadinhosShopee #ShopeeFinds) + a palavra-chave do
  produto + quando for MODA FEMININA use #ModaFemininaShopee #modafeminina #lookdodia
  #TendenciaShopee. Sem espaço, com acento quando fizer sentido.
- Roteiro de voz: falado natural, com pausas (vírgulas/reticências), gancho no início, CTA no fim.
- SEMPRE português correto com acentuação.
- Responda SOMENTE com JSON válido, sem nada fora do JSON."""

TONS = {
    "agressivo": "TOM AGRESSIVO: urgência alta, gatilhos fortes, CAPS nas palavras-chave, "
                 "frases de choque ('NÃO ACREDITO', 'CORRE'), escassez explícita. Punchy e direto.",
    "equilibrado": "TOM EQUILIBRADO: persuasivo e natural, mistura benefício + gatilho sem exagero.",
    "tranquilo": "TOM TRANQUILO: calmo, elegante e aspiracional, foco em qualidade e no "
                 "benefício, sem gritar. Sofisticado.",
}


def _gen(prompt):
    """Chama o Gemini revezando as chaves; tenta a proxima se uma falhar."""
    erros = []
    for _ in range(len(_KEYS)):
        key = next(_ciclo)
        try:
            client = genai.Client(api_key=key)
            resp = _call(client,
                model=MODELO,
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=SISTEMA,
                    response_mime_type="application/json",
                    temperature=0.9,
                ),
            )
            return json.loads(resp.text)
        except Exception as e:
            erros.append(str(e)[:120])
            continue
    raise RuntimeError("Todas as chaves Gemini falharam: " + " | ".join(erros))


def gerar_copy(produto, descricao, formato="legenda", plataforma="shopee",
               tom="equilibrado", n_legendas=6, contexto_visual="", preco=""):
    """
    Retorna dict:
      formato 'legenda'/'rec': {captions:[...], descricao:str, hashtags:[...]}
      formato 'voz':          {roteiro:str, descricao:str, hashtags:[...]}
    contexto_visual: descrição das cenas do vídeo (na ordem) pra copy casar com a tela.
    """
    if not _KEYS:
        raise RuntimeError("Nenhuma GEMINI_API_KEY no .env")

    instr_tom = TONS.get(tom, TONS["equilibrado"])
    base = f"""Produto: {produto}
{f'Preço: {preco}' if preco else ''}
Plataforma: {plataforma}
{instr_tom}

Descrição do fornecedor (use como base, extraia os melhores argumentos de venda):
\"\"\"{descricao[:4000]}\"\"\"
"""
    # CÉREBRO COM FEEDBACK REAL: se o analisar.py já gerou aprendizados a partir das
    # métricas dos vídeos postados (resultados.csv), eles entram em toda copy nova
    _apr = os.path.join(os.path.dirname(os.path.abspath(__file__)), "aprendizados.txt")
    if os.path.exists(_apr):
        with open(_apr, encoding="utf-8") as f:
            txt = f.read().strip()
        if txt:
            base += f"""
APRENDIZADOS REAIS DESTE PERFIL (dados de vídeos já postados — siga com prioridade):
{txt[:2000]}
"""
    if contexto_visual:
        base += f"""
CENAS DO VÍDEO, NA ORDEM EM QUE APARECEM:
{contexto_visual}
IMPORTANTE: as legendas/roteiro são exibidas em sequência junto com essas cenas.
Escreva na MESMA ordem das cenas, pra cada frase fazer sentido com o que está na
tela naquele momento (ex.: se a cena mostra o tecido de perto, a frase fala do tecido).
"""

    if formato == "voz":
        pedido = base + f"""
Gere a copy para um vídeo de venda NARRADO. Responda em JSON com as chaves:
{{
  "roteiro": "texto falado natural de ~12 a 18 segundos, com gancho, 2-3 benefícios e CTA",
  "descricao": "descrição da {plataforma} otimizada para busca",
  "hashtags": ["#tag1", "#tag2", ... 12 a 15]
}}"""
    else:
        pedido = base + f"""
Gere a copy para um vídeo de venda com LEGENDAS na tela. Responda em JSON com as chaves:
{{
  "captions": [{n_legendas} legendas curtas de tela, a 1a é o gancho, a última é o CTA],
  "descricao": "descrição da {plataforma} otimizada para busca",
  "hashtags": ["#tag1", "#tag2", ... 12 a 15]
}}"""

    return _gen(pedido)


def prompt_cena_veo(produto, descricao, imagem_bytes, mime="image/jpeg"):
    """Gemini OLHA a foto do produto (visão) e escreve um prompt em inglês para o Veo
    animar a imagem num clipe simples de modelo mostrando o produto. Grátis."""
    if not _KEYS:
        raise RuntimeError("Nenhuma GEMINI_API_KEY no .env")
    instr = f"""Produto: {produto}
Descrição: {descricao[:1500]}

Olhe a FOTO do produto e escreva um prompt EM INGLÊS, curto e simples, para um modelo
de imagem-para-vídeo (Veo) animar ESTA foto num clipe vertical 9:16 de ~5 segundos
mostrando bem o produto. Mantenha a pessoa, o rosto e a roupa EXATAMENTE iguais.
Movimento mínimo e natural (giro leve, leve mudança de pose, cabelo/tecido se movendo,
câmera lenta). O clipe deve começar JÁ EM MOVIMENTO desde o primeiro frame (nunca
estático no início — isso segura o scroll). Nada que distorça o produto. Inclua sempre
'fully clothed, tasteful, photorealistic, 9:16 vertical'.
Responda SOMENTE em JSON: {{"prompt": "...", "negative": "..."}}"""
    erros = []
    for _ in range(len(_KEYS)):
        key = next(_ciclo)
        try:
            client = genai.Client(api_key=key)
            resp = _call(client,
                model=MODELO,
                contents=[types.Part.from_bytes(data=imagem_bytes, mime_type=mime), instr],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json", temperature=0.7),
            )
            return json.loads(resp.text)
        except Exception as e:
            erros.append(str(e)[:120])
    raise RuntimeError("Gemini visão falhou: " + " | ".join(erros))


def remover_marca_dagua(imagem_bytes, mime="image/jpeg", modelo="gemini-2.5-flash-image"):
    """IA olha a imagem, identifica marca d'água/logo/texto e devolve LIMPA, mantendo
    o mesmo padrão (produto/pessoa/fundo/enquadramento iguais). Retorna bytes ou None."""
    if not _KEYS:
        return None
    instr = ("Remove any watermark, logo, store name, price tag, username or text overlay "
             "from this product photo. Keep EVERYTHING else exactly the same: same product, "
             "same person, same pose, same background, same colors, same framing and "
             "composition. Only erase the watermark/logo and fill that area naturally and "
             "seamlessly. Output only the cleaned image, same resolution.")
    erros = []
    for _ in range(len(_KEYS)):
        key = next(_ciclo)
        try:
            client = genai.Client(api_key=key)
            resp = _call(client,
                model=modelo,
                contents=[types.Part.from_bytes(data=imagem_bytes, mime_type=mime), instr],
            )
            for part in resp.candidates[0].content.parts:
                inl = getattr(part, "inline_data", None)
                if inl and inl.data:
                    return inl.data
            erros.append("sem imagem na resposta")
        except Exception as e:
            erros.append(str(e)[:120])
    return None


def tem_pessoa(imagem_bytes, mime="image/jpeg"):
    """A imagem mostra uma PESSOA humana vestindo/segurando o produto? (visão, grátis)."""
    if not _KEYS:
        return True
    try:
        client = genai.Client(api_key=next(_ciclo))
        resp = _call(client,
            model=MODELO,
            contents=[types.Part.from_bytes(data=imagem_bytes, mime_type=mime),
                      'Existe uma PESSOA humana real (uma modelo/pessoa) visível nesta '
                      'imagem? Responda só JSON {"pessoa": true|false}.'],
            config=types.GenerateContentConfig(response_mime_type="application/json"),
        )
        v = json.loads(resp.text).get("pessoa", False)
        if isinstance(v, str):
            return v.strip().lower() in ("true", "sim", "yes", "1")
        return bool(v)
    except Exception:
        return False  # na dúvida: gera modelo (NUNCA anima a roupa solta)


def vestir_modelo(imagem_bytes, produto, mime="image/jpeg", modelo="gemini-2.5-flash-image"):
    """Pega a foto do produto (sem pessoa) e cria uma MODELO humana vestindo/usando a
    peça, mantendo o produto idêntico. Retorna bytes da imagem ou None."""
    if not _KEYS:
        return None
    instr = (f"Using the product shown in this reference image ({produto}), create a "
             "photorealistic photo of a real human female model wearing or presenting "
             "this EXACT product. Keep the product identical: same item, same color, "
             "same print/logo, same details. Three-quarter or full body, natural "
             "confident pose, clean soft-lit studio background, fashion catalog style, "
             "vertical 9:16. Photorealistic, tasteful, fully clothed. Output only the image.")
    erros = []
    for _ in range(len(_KEYS)):
        key = next(_ciclo)
        try:
            client = genai.Client(api_key=key)
            resp = _call(client,
                model=modelo,
                contents=[types.Part.from_bytes(data=imagem_bytes, mime_type=mime), instr],
            )
            for part in resp.candidates[0].content.parts:
                inl = getattr(part, "inline_data", None)
                if inl and inl.data:
                    return inl.data
            erros.append("sem imagem")
        except Exception as e:
            erros.append(str(e)[:120])
    return None


def analisar_produto_print(prints):
    """Lê PRINTS de uma página de produto da Shopee (visão) e extrai os dados +
    julga o potencial de venda. prints = lista de (bytes, mime).
    Retorna dict: {produto, preco, vendidos, avaliacao, descricao, em_alta,
    potencial (0-10), motivo, publico}."""
    if not _KEYS or not prints:
        raise RuntimeError("Sem chave Gemini ou sem prints")
    partes = []
    for b, mime in prints:
        partes.append(types.Part.from_bytes(data=b, mime_type=mime))
    partes.append("""Estes são prints de uma página de produto da Shopee Brasil.

1. EXTRAIA da página: nome do produto, preço atual (o promocional, ex "R$ 9,90"),
   quantidade de vendidos (ex "1,2mil vendidos"), nota de avaliação e nº de avaliações,
   e os pontos principais da descrição/variações visíveis.
2. JULGUE o potencial pra um afiliado fazer vídeo desse produto AGORA, considerando:
   muitos vendidos + nota alta = demanda comprovada; preço baixo (< R$25) = compra por
   impulso e converte fácil em vídeo; nicho (moda feminina, bebê, casa, cozinha) =
   funciona bem no Shopee Vídeo; concorrência e apelo visual do produto.
3. Escreva uma descrição CURTA do produto (2-3 frases, dados reais do print) que
   servirá de base pro copywriter.

Responda SOMENTE JSON:
{"produto": "nome completo", "preco": "R$ X,XX", "vendidos": "texto do print",
 "avaliacao": "4.9 (123)", "descricao": "2-3 frases", "em_alta": true|false,
 "potencial": 0-10, "motivo": "1-2 frases explicando o veredito",
 "publico": "quem compra"}""")
    erros = []
    for _ in range(len(_KEYS)):
        key = next(_ciclo)
        try:
            client = genai.Client(api_key=key)
            resp = _call(client,
                model=MODELO, contents=partes,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json", temperature=0.3),
            )
            return json.loads(resp.text)
        except Exception as e:
            erros.append(str(e)[:120])
    raise RuntimeError("Gemini visão falhou: " + " | ".join(erros))


def variar_imagem(imagem_bytes, produto, var_idx=1, mime="image/jpeg",
                  modelo="gemini-2.5-flash-image"):
    """Gera uma foto NOVA do MESMO produto (anti-duplicado pras variantes): outra
    modelo/pose/cenário, mas o produto IDÊNTICO. Retorna bytes ou None."""
    if not _KEYS:
        return None
    cenarios = ["bright modern bedroom with soft morning light",
                "urban street style, golden hour outdoor",
                "minimal beige studio with warm tones",
                "cozy living room, natural window light"]
    cena = cenarios[var_idx % len(cenarios)]
    instr = (f"Using the EXACT product shown in this reference image ({produto}), create "
             f"a COMPLETELY NEW photorealistic photo: a different human female model, "
             f"different pose and angle, new setting ({cena}). The product itself must "
             "stay IDENTICAL: same item, same color, same print/details/material. "
             "Vertical 9:16, fashion catalog quality, photorealistic, tasteful, fully "
             "clothed. Output only the image.")
    erros = []
    for _ in range(len(_KEYS)):
        key = next(_ciclo)
        try:
            client = genai.Client(api_key=key)
            resp = _call(client,
                model=modelo,
                contents=[types.Part.from_bytes(data=imagem_bytes, mime_type=mime), instr],
            )
            for part in resp.candidates[0].content.parts:
                inl = getattr(part, "inline_data", None)
                if inl and inl.data:
                    return inl.data
            erros.append("sem imagem")
        except Exception as e:
            erros.append(str(e)[:120])
    return None


def plano_edicao(produto, descricao, imagens_paths, n_videos=0, max_fotos=4):
    """O CÉREBRO EDITOR: Gemini OLHA todas as fotos + sabe se há vídeo, e devolve um
    plano de edição completo:
      {indices: [ordem das fotos], dur_imagem: seg por foto, ordem: sequencial|intercalado,
       cenas: "descrição curta de cada cena, na ordem"}
    Sempre retorna um plano utilizável (fallback seguro se a IA falhar)."""
    fallback = {"indices": list(range(len(imagens_paths))), "dur_imagem": 3.0,
                "ordem": "sequencial", "cenas": ""}
    if not _KEYS or not imagens_paths:
        return fallback
    partes = []
    for i, p in enumerate(imagens_paths):
        with open(p, "rb") as f:
            b = f.read()
        mime = "image/png" if p.lower().endswith(".png") else "image/jpeg"
        partes.append(types.Part.from_bytes(data=b, mime_type=mime))
        partes.append(f"[imagem {i}]")
    partes.append(f"""Você é o EDITOR de um vídeo de venda vertical (9:16) para Shopee.
Produto: {produto}
Descrição: {descricao[:1200]}
Estrutura do vídeo: {"começa com " + str(n_videos) + " clipe(s) de vídeo do produto, " if n_videos else ""}depois entram as fotos acima (numeradas de 0 a {len(imagens_paths)-1}).

Monte o MELHOR plano de edição pra vender:
1. Escolha quais fotos entram e em QUE ORDEM (conte uma história: visual geral ->
   detalhe/benefício -> variações/cores). Descarte duplicadas, ruins ou confusas.
   Pode ser todas, ou só 1 ou 2 — o que vender melhor. Máximo {max_fotos}.
2. Duração de cada foto na tela (entre 2.0 e 3.5 segundos; menos fotos = pode ficar mais).
3. "cenas": descreva CURTO cada cena na ordem final ({"vídeo primeiro, " if n_videos else ""}depois cada foto escolhida), ex.: "1) vídeo: modelo girando com o conjunto; 2) foto: detalhe da costura...". Isso vai guiar o copywriter.

Responda SOMENTE JSON:
{{"indices": [números na ordem de exibição], "dur_imagem": 2.5,
  "ordem": "sequencial", "cenas": "1) ...; 2) ...; 3) ..."}}""")
    erros = []
    for _ in range(len(_KEYS)):
        key = next(_ciclo)
        try:
            client = genai.Client(api_key=key)
            resp = _call(client,
                model=MODELO, contents=partes,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json", temperature=0.4),
            )
            d = json.loads(resp.text)
            idx = [i for i in d.get("indices", [])
                   if isinstance(i, int) and 0 <= i < len(imagens_paths)]
            if not idx:
                idx = fallback["indices"]
            try:
                dur = float(d.get("dur_imagem", 3.0))
            except (TypeError, ValueError):
                dur = 3.0
            return {"indices": idx[:max_fotos],
                    "dur_imagem": min(4.0, max(1.5, dur)),
                    "ordem": d.get("ordem") or "sequencial",
                    "cenas": str(d.get("cenas", ""))[:1500]}
        except Exception as e:
            erros.append(str(e)[:120])
    return fallback  # IA falhou -> usa todas, 3s cada


def selecionar_imagens(produto, imagens_paths, max_fotos=4):
    """Gemini OLHA as fotos e decide quais valem a pena mostrar (todas, 1 ou 2...).
    Descarta duplicadas/ruins/irrelevantes. Retorna lista de caminhos (melhores 1o)."""
    if not _KEYS or len(imagens_paths) <= 1:
        return list(imagens_paths)
    partes = []
    for i, p in enumerate(imagens_paths):
        with open(p, "rb") as f:
            b = f.read()
        mime = "image/png" if p.lower().endswith(".png") else "image/jpeg"
        partes.append(types.Part.from_bytes(data=b, mime_type=mime))
        partes.append(f"[imagem {i}]")
    partes.append(f"""Produto: {produto}
Acima estão {len(imagens_paths)} imagens (numeradas de 0 a {len(imagens_paths)-1}).
Escolha quais valem a pena MOSTRAR num vídeo de venda curto. Descarte duplicadas,
baixa qualidade, confusas ou irrelevantes. Pode ser todas, ou só 1, ou 2 — o que for
melhor pra vender. Ordene da MELHOR para a pior. No máximo {max_fotos}.
Responda SOMENTE JSON: {{"indices": [lista de números], "motivo": "curto"}}""")
    erros = []
    for _ in range(len(_KEYS)):
        key = next(_ciclo)
        try:
            client = genai.Client(api_key=key)
            resp = _call(client,
                model=MODELO, contents=partes,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json", temperature=0.3),
            )
            d = json.loads(resp.text)
            idx = [i for i in d.get("indices", []) if isinstance(i, int) and 0 <= i < len(imagens_paths)]
            sel = [imagens_paths[i] for i in idx][:max_fotos]
            return sel or list(imagens_paths)
        except Exception as e:
            erros.append(str(e)[:120])
    return list(imagens_paths)  # se falhar, usa todas


if __name__ == "__main__":
    # teste rapido
    d = gerar_copy(
        "Kit Top + Legging Fitness AQN Grace Preta",
        "Legging fitness suplex, cintura alta, alta cobertura nao fica transparente, "
        "toque gelado, secagem rapida, costuras reforcadas. Academia, treino, casual.",
        formato="legenda",
    )
    print(json.dumps(d, ensure_ascii=False, indent=2))
