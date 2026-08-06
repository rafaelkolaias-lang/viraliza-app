# Mapa dos prompts de vídeo do Lab

Onde a gente registra **o que funciona de verdade** em cada combinação, pra parar
de adivinhar. Cada linha só é preenchida depois de um vídeo gerado e assistido.

> Regra: um teste muda **uma variável de cada vez**. Se mudar duas, não dá pra
> saber qual causou o resultado.

## O que já sabemos (05-06/ago/2026)

| Descoberta | Detalhe |
|---|---|
| **O começo do prompt é que manda** | O motor do Grok (Aurora) renderiza do primeiro quadro em diante, e o que está nas primeiras 20 a 30 palavras é o que ele executa. Ação-chave no fim "chega tarde". Antes a gente fazia o contrário: tinha um bloco "LEIA ISTO POR ÚLTIMO" e o movimento aparecia lá pela palavra 450. Agora a ação abre o prompt. Exceção: a trava de preservação ("mantenha o mesmo rosto") ganha ficando no fim, porque é restrição estática, não ação. |
| **Negativa sobre coisa visível PLANTA a coisa** | A API do Grok não tem campo de negative prompt, então "sem membro extra" não vira proibição: vira menção, e o modelo pode materializar. Doc oficial da Runway: "negative phrasing is not supported and may produce unpredictable or even opposite results". Sobrevivem só as negativas TÉCNICAS (sem legenda, sem música), que não têm objeto visual pra plantar. |
| **Mão ancorada, não mão contada** | O jeito com fonte de evitar membro extra é dizer ONDE cada mão está e o que ela toca ("a outra mão segura o celular, fora do quadro"), não contar ("sobra UMA ÚNICA mão, nenhuma terceira mão existe"). Contar repete a palavra "mão" e planta. |
| **Prompt curto ganha** | Teste A/B em 06/ago: 742 palavras (versão antiga) contra 143 (versão nova, mesma cena). A curta ganhou com folga. Os guias de Grok convergem em 30 a 80 palavras de direção. |
| **Não redescrever a imagem** | A foto já carrega pessoa, produto, roupa e cenário. Todo token gasto redescrevendo é token roubado da direção de movimento. |
| **Gesto tem tamanho, vídeo tem outro** | Movimento validado em 6s sobra tempo em 10s e 15s, e aí o modelo arrasta em câmera lenta ou inventa um segundo gesto (de onde sai o braço extra). Solução: o gesto acontece uma vez e depois a pessoa só permanece em cena. |
| **Braço extra** | Nasce quando o prompt pede mais ações simultâneas do que mãos disponíveis (ex.: "segura o celular **e** aponta pro produto" — sobra o produto sem mão). A regra "2 braços" não segura sozinha: o modelo obedece a ação e quebra a anatomia. Solução: **orçamento de mãos** explícito. |
| **Fala cortada no fim** | O modelo enche o tempo todo e engole a última palavra. Solução: mandar **terminar 1s antes** e deixar silêncio no fim. Limite baixado de 2,3 → 2,0 palavras/s. |
| **Fala arrastada** (efeito colateral do conserto acima) | Ao ler "termina até o segundo 14", o modelo entendeu **meta** e esticou a fala pra preencher. Solução: o **ritmo vem antes do prazo** no prompt, o prazo é declarado como TETO ("se acabar antes, ótimo") e é proibido alongar vogais/pausas pra encher o tempo. |
| **Fundo borrado** | Vinha da lente de retrato no prompt da imagem (85mm f/1.8 + "shallow depth of field"). Removido; agora exige foco nítido em tudo. |
| **Boca parada** | A voz saía como narração e a boca só acordava depois. Solução: regra de sincronia labial desde o 1º segundo. |

## Limites por duração (depois do ajuste)

**2,0 palavras por segundo.** É o único número validado em vídeo de verdade: 30
palavras em 15s e 19 em 10s saíram com a última palavra inteira.

| Duração | Fala? | Palavras | Créditos | Pra que serve |
|---|---|---|---|---|
| 6s | não | - | 50 | capa, anúncio curto, produto aparecendo |
| 10s | sim | até **20** | 70 | uma frase de venda |
| 15s | sim | até **30** | 95 | gancho + benefício + chamada |

Em 06/ago o número foi unificado nos três lugares que tinham valor próprio:
`lab-video.ts` (já estava 2,0), `viral-boost.ts` (estava 2,3, dava 34 palavras em
15s) e `avatar-modelo.ts` (estava 2,5, dava 38). Os dois últimos atropelavam a
fala pelo mesmo motivo que o Lab atropelava antes do conserto.

## Matriz de teste

Status: ⬜ não testado · ✅ funciona · ⚠️ funciona com ressalva · ❌ falha

| # | Movimento | Duração | Hipótese testada | Status | Observação |
|---|---|---|---|---|---|
| 1 | Girar o produto nas mãos | 10s | orçamento de mãos evita braço extra | ✅ | ficou bom (06/ago) |
| 2 | Girar o produto nas mãos | 15s | a fala de 30 palavras cabe | ✅ | 30 palavras é o teto certo. Só funcionou com o bloco de RITMO antes do prazo (06/ago) |
| 3 | Produto parado + câmera se aproxima | 10s | sem girar fica melhor que girando? | ⬜ | comparar com o #1 |
| 4 | Selfie apontando pro produto | 10s | confirma a causa do braço extra | ⬜ | é o pior prompt de hoje |
| 5 | POV só mãos (sem rosto) | 10s | POV mantém a fala sincronizada | ⬜ | |
| 6 | Vestindo (corpo inteiro) | 15s | corpo inteiro sem cortar pernas | ⬜ | |
| 7 | Espelho | 15s | reflexo não duplica nem distorce | ⬜ | |
| 8 | Sem fala | 6s | movimento sozinho segura o vídeo | ⬜ | |

## O que olhar em cada vídeo

1. **Mãos e braços**: contar. Apareceu mão sem dono? Dedo a mais?
2. **Fala**: a última palavra saiu inteira? Sobrou silêncio no fim?
3. **Boca**: começou a mexer junto com o áudio, desde o começo?
4. **Produto**: mudou de forma, cor ou rótulo em algum quadro?
5. **Fundo**: continuou nítido do início ao fim?
6. **Rosto**: continua a mesma pessoa da foto no último quadro?
