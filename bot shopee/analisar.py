# -*- coding: utf-8 -*-
"""
CÉREBRO COM FEEDBACK REAL - analisa a planilha resultados.csv com o Gemini e gera
aprendizados.txt, que entra automaticamente em TODA copy nova (gemini_copy.gerar_copy).

Fluxo: posta os vídeos -> preenche views/curtidas/cliques na planilha ->
       python analisar.py -> próximos vídeos já saem ajustados pro SEU público.
"""
import os
import csv
import itertools
from dotenv import load_dotenv
from google import genai

load_dotenv()
BASE = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(BASE, "resultados.csv")
SAIDA_TXT = os.path.join(BASE, "aprendizados.txt")

_KEYS = [k for k in (os.getenv("GEMINI_API_KEY"), os.getenv("GEMINI_API_KEY_2"),
                     os.getenv("GEMINI_API_KEY_3")) if k]
_ciclo = itertools.cycle(_KEYS) if _KEYS else None


def main():
    if not os.path.exists(CSV_PATH):
        print("resultados.csv não existe ainda — rode antes: python pacote.py")
        return
    with open(CSV_PATH, encoding="utf-8-sig", newline="") as f:
        linhas = list(csv.DictReader(f, delimiter=";"))
    com_dados = [l for l in linhas if (l.get("views") or "").strip()]
    if not com_dados:
        print("Nenhum vídeo com métricas preenchidas ainda. Preencha 'views' (e o que "
              "mais tiver) na planilha e rode de novo.")
        return

    tabela = "\n".join(
        f"- {l['arquivo']} | produto: {l['produto']} | formato: {l['formato']} | "
        f"tom: {l['tom']} | duração: {l['duracao_s']}s | postado: {l['data']} {l['horario']} | "
        f"views: {l['views']} | curtidas: {l.get('curtidas','')} | "
        f"comentários: {l.get('comentarios','')} | cliques sacolinha: "
        f"{l.get('cliques_sacolinha','')} | pedidos: {l.get('pedidos','')} | "
        f"obs: {l.get('obs','')}" for l in com_dados)

    prompt = f"""Você é um estrategista de Shopee Vídeos analisando os resultados REAIS
do perfil de um afiliado brasileiro (nicho principal: moda feminina e achadinhos).

DADOS DOS VÍDEOS POSTADOS:
{tabela}

Total de vídeos na planilha (incluindo sem métrica ainda): {len(linhas)}.

Analise o que está performando MELHOR e PIOR neste perfil: tipo de produto, formato
(voz narrada vs legenda), tom, duração, horário, faixa de preço, estilo de gancho
(deduza pelo produto/obs). Considere que poucos dados = conclusões provisórias.

Escreva de 4 a 8 DIRETRIZES curtas e acionáveis para os PRÓXIMOS vídeos deste perfil
(serão injetadas direto no prompt do copywriter). Formato: uma diretriz por linha,
começando com "- ". Seja específico (ex.: "- Priorize gancho de economia: produtos
abaixo de R$15 com selo de promoção foram os mais vistos"). Responda SÓ as diretrizes,
sem introdução."""

    erros = []
    for _ in range(len(_KEYS)):
        try:
            client = genai.Client(api_key=next(_ciclo))
            resp = client.models.generate_content(model="gemini-2.5-flash",
                                                  contents=prompt)
            texto = (resp.text or "").strip()
            if texto:
                with open(SAIDA_TXT, "w", encoding="utf-8") as f:
                    f.write(texto + "\n")
                print(f"Aprendizados salvos em {SAIDA_TXT} "
                      f"({len(com_dados)} vídeo(s) com métricas):\n")
                print(texto)
                print("\nToda copy nova já vai usar isso automaticamente.")
                return
        except Exception as e:
            erros.append(str(e)[:120])
    print("Falhou em todas as chaves: " + " | ".join(erros))


if __name__ == "__main__":
    main()
