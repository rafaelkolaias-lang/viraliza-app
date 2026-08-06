# Prompts pra gerar os vídeos de exemplo dos movimentos

Os cards do passo "Movimento do vídeo" tocam um vídeo curto, mudo e em loop,
servido do serverrk em `media/lab/movimentos/<chave>.mp4` (+ `<chave>.jpg` de
poster). Trocar um exemplo é só sobrescrever o arquivo por scp — não precisa
deploy.

**Gerar como:** 6 segundos, SEM FALA (o card é mudo e em loop). São 50 créditos
cada.

**Imagem base:** use uma imagem que combine com o grupo (POV = foto só das mãos
com o produto; vestindo = pessoa de corpo inteiro com a roupa; e por aí). A mesma
imagem serve pros 3 do grupo.

---

## BASE (cola sempre, em todos)

```
Vídeo vertical 9:16, 6 segundos, realismo total, como se a pessoa tivesse gravado no celular.

A IMAGEM É A VERDADE ABSOLUTA: mesma pessoa, mesmo produto e mesmo ambiente da foto. Não troque nada, não recrie e não estilize.

SEM FALA: vídeo mudo, ninguém fala e não existe narração.

NITIDEZ: vídeo inteiro nítido em 4K, cenário de fundo em foco do início ao fim. Sem desfoque, sem bokeh.

ANATOMIA: exatamente 2 braços, 2 pernas e 5 dedos em cada mão, o tempo todo. Nenhum membro extra, nenhuma mão sem dono, nada derretendo durante o movimento.

SAÍDA LIMPA: sem legenda, sem texto na tela, sem logo, sem marca d'água, sem música e sem efeito.

MOVIMENTO:
```

Depois do `MOVIMENTO:` cola a linha do movimento que você quer gerar.

---

## POV (só as mãos) — imagem base: foto só das mãos segurando o produto

**Arquivo `pov-girar.mp4`**
```
Só as mãos aparecem, mais nada. As DUAS mãos seguram o produto e giram ele devagar, mostrando a frente e depois a lateral. As mãos não largam o produto em nenhum momento e nenhuma outra mão entra em cena. Faz só esse movimento do começo ao fim, sem trocar de gesto no meio.
```

**Arquivo `pov-aproximar.mp4`**
```
Só as mãos aparecem, mais nada. As DUAS mãos seguram o produto virado pra câmera e o trazem devagar em direção a ela, até ele ocupar boa parte do quadro. As mãos não giram o produto e não trocam de posição. Faz só esse movimento do começo ao fim, sem trocar de gesto no meio.
```

**Arquivo `pov-revelar.mp4`**
```
Só as mãos aparecem, mais nada. A mão esquerda segura o produto firme; a mão direita abre a tampa ou afasta a embalagem, um gesto único e calmo. Terminada a abertura, as duas mãos voltam a segurar o produto virado pra câmera. Existem só essas duas mãos. Faz só esse movimento do começo ao fim, sem trocar de gesto no meio.
```

---

## CÂMERA (ninguém em cena) — imagem base: produto sozinho na bancada

**Arquivo `cam-aproximar.mp4`**
```
NÃO existe ninguém em cena: nenhuma mão, nenhum braço, nenhuma pessoa. O produto fica exatamente onde está, parado. Só a CÂMERA se move, numa aproximação lenta e contínua em direção a ele. Faz só esse movimento do começo ao fim.
```

**Arquivo `cam-orbita.mp4`**
```
NÃO existe ninguém em cena: nenhuma mão, nenhum braço, nenhuma pessoa. O produto fica parado no lugar e só a CÂMERA se move, deslizando devagar em volta dele e revelando outro ângulo. O produto não gira sozinho nem sai do lugar. Faz só esse movimento do começo ao fim.
```

**Arquivo `cam-revelar.mp4`**
```
NÃO existe ninguém em cena: nenhuma mão, nenhum braço, nenhuma pessoa. A CÂMERA desliza devagar para o lado e o produto vai entrando no quadro até ficar centralizado e nítido. O produto permanece parado. Faz só esse movimento do começo ao fim.
```

---

## DE FRENTE — imagem base: pessoa de frente segurando o produto com as 2 mãos

**Arquivo `frente-camera-chega.mp4`**
```
A pessoa tem EXATAMENTE 2 braços e 2 mãos, e as duas estão ocupadas segurando o produto na altura do peito, virado pra câmera. Nenhuma outra mão existe e ela não aponta nem pega mais nada. Ela fica parada, com micro-movimentos naturais (respiração, piscadas, leve sorriso); quem se move é a CÂMERA, numa aproximação lenta. Faz só esse movimento do começo ao fim, sem trocar de gesto no meio.
```

**Arquivo `frente-apresentar.mp4`**
```
A pessoa tem EXATAMENTE 2 braços e 2 mãos, as duas segurando o produto: a direita pela lateral, a esquerda apoiando por baixo. Nenhuma outra mão existe. Ela aproxima o produto devagar da câmera e gira ele levemente pra mostrar a frente. As mãos não largam o produto e ela não aponta pra nada. Faz só esse movimento do começo ao fim, sem trocar de gesto no meio.
```

**Arquivo `frente-reagir.mp4`**
```
A pessoa tem EXATAMENTE 2 braços e 2 mãos, as duas segurando o produto na altura do peito o tempo todo. Nenhuma outra mão existe: ela NÃO leva a mão ao rosto, não aponta e não mexe no cabelo. O movimento é só do olhar e da expressão: ela olha pro produto, abre um sorriso de surpresa e levanta os olhos pra câmera. Faz só esse movimento do começo ao fim, sem trocar de gesto no meio.
```

---

## VESTINDO — imagem base: pessoa de corpo inteiro vestindo a peça

**Arquivo `vestindo-girar.mp4`**
```
O produto é a roupa que ela está vestindo, então as DUAS mãos ficam livres e vazias, soltas ao lado do corpo: ela não segura nada. Ela gira o corpo devagar, da frente pro lado e volta, mostrando a peça inteira. Enquadramento de CORPO INTEIRO, da cabeça aos pés, sem cortar as pernas nem os pés. Faz só esse movimento do começo ao fim, sem trocar de gesto no meio.
```

**Arquivo `vestindo-ajustar.mp4`**
```
O produto é a roupa que ela está vestindo, então as DUAS mãos estão livres: ela não segura nenhum objeto. Com as duas mãos ela ajeita a peça uma única vez (alinha a barra ou o ombro) e depois volta a deixar os braços soltos ao lado do corpo. Existem só esses 2 braços. Enquadramento de CORPO INTEIRO, sem cortar as pernas. Faz só esse movimento do começo ao fim, sem trocar de gesto no meio.
```

**Arquivo `vestindo-passo.mp4`**
```
O produto é a roupa que ela está vestindo, então as DUAS mãos ficam livres e vazias, soltas ao lado do corpo. Ela dá um passo calmo em direção à câmera e para, com o tecido reagindo naturalmente ao movimento. Enquadramento de CORPO INTEIRO, da cabeça aos pés. Faz só esse movimento do começo ao fim, sem trocar de gesto no meio.
```

---

## SELFIE — imagem base: selfie da pessoa com o produto numa mão só ✅ GERADO 06/ago

> É aqui que nascia o braço extra: uma mão já segura o celular, então **sobra
> uma só**. Nunca peça duas tarefas pra mão livre.
>
> Os 3 já estão no ar em `media/lab/movimentos/`. O terceiro era
> `selfie-reagir` (só olhar e expressão) e **saiu horrível**: sem movimento de
> corpo o modelo entrega foto tremida ou inventa gesto pra preencher. Foi
> trocado por `selfie-andando`.
>
> Lição que vale pros próximos grupos: **todo movimento precisa de movimento
> físico de verdade**. Prompt de "só expressão" não sustenta 6 segundos.

**Arquivo `selfie-mostrar.mp4`**
```
É uma selfie: UMA das mãos dela segura o celular e fica FORA do quadro, então sobra UMA ÚNICA mão visível. Essa mão livre segura o produto e o levanta até perto do rosto, virado pra câmera. Ela NÃO aponta pro produto, NÃO mexe no cabelo e NÃO pega mais nada: a mão livre já está ocupada com o produto. Nenhuma terceira mão existe. Faz só esse movimento do começo ao fim, sem trocar de gesto no meio.
```

**Arquivo `selfie-aproximar.mp4`**
```
É uma selfie: UMA das mãos dela segura o celular e fica FORA do quadro, então sobra UMA ÚNICA mão visível, e ela já está segurando o produto. Essa mão traz o produto devagar em direção à câmera, até ele ficar bem visível ao lado do rosto. Nenhuma outra mão aparece e ela não faz nenhum outro gesto. Faz só esse movimento do começo ao fim, sem trocar de gesto no meio.
```

**Arquivo `selfie-andando.mp4`** (substituiu o `selfie-reagir`, que falhou)
```
É uma selfie: UMA das mãos dela segura o celular e fica FORA do quadro, então aparece UMA mão só, a que segura o produto ao lado do rosto. Ela caminha devagar em direção à câmera enquanto se filma, com o corpo balançando no ritmo natural do passo e o ambiente se aproximando junto. Ela olha pra câmera o tempo todo. Faz só esse movimento do começo ao fim, sem trocar de gesto no meio.
```

---

## ESPELHO — imagem base: foto no espelho, corpo inteiro

**Arquivo `espelho-girar.mp4`**
```
É uma foto no espelho: UMA das mãos dela segura o celular na frente do corpo (aparece no reflexo) e a outra fica solta ao lado do corpo, vazia. São só 2 braços no total, contando o reflexo. Ela gira o corpo devagar diante do espelho, mostrando a roupa de frente e de lado. O reflexo mostra a MESMA pessoa, sem duplicar nem deformar. Enquadramento de CORPO INTEIRO. Faz só esse movimento do começo ao fim, sem trocar de gesto no meio.
```

**Arquivo `espelho-parada.mp4`**
```
É uma foto no espelho: UMA das mãos dela segura o celular na frente do corpo (aparece no reflexo) e a outra fica solta ao lado, vazia. São só 2 braços no total, contando o reflexo. Ela fica parada na pose, com micro-movimentos naturais (respiração, piscadas, leve troca de peso). O reflexo mostra a MESMA pessoa, sem duplicar. Enquadramento de CORPO INTEIRO. Faz só esse movimento do começo ao fim.
```

**Arquivo `espelho-chegar.mp4`**
```
É uma foto no espelho: UMA das mãos dela segura o celular na frente do corpo (aparece no reflexo) e a outra fica solta ao lado, vazia. São só 2 braços no total, contando o reflexo. Ela dá um passo calmo em direção ao espelho e para, mantendo a pose. O reflexo acompanha o movimento mostrando a MESMA pessoa, sem duplicar nem deformar. Faz só esse movimento do começo ao fim, sem trocar de gesto no meio.
```

---

## Depois de gerar

Baixe cada vídeo, me mande (ou salve numa pasta) com o nome exato do arquivo
acima. Eu recomprimo pra 480px sem áudio (os crus do Grok são pesados demais pra
uma tela com vários tocando juntos), gero o poster `.jpg` e subo pro serverrk.
