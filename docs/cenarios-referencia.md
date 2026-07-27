# Referências de cenário do avatar (casas brasileiras reais)

Fotos que o Lucas mandou pra guiar os cenários do "Meus avatares". Os arquivos
originais estão em `docs/referencias/`. A geração é text-to-image (gpt-image-1),
então elas viram DESCRIÇÃO nos cenários (`src/lib/avatar-modelo.ts`, `CENARIOS`) +
na trava de fundo (`src/lib/avatar-json.ts`). Objetivo: casa de gente comum, do dia
a dia, nada de estúdio. O fundo entra SEMPRE desfocado (a pessoa fica nítida).

## `casasala.png` -> cenário `sala`
Sala de classe média arrumada: parede branca com painel 3D texturizado, TV na parede,
rack branco com orquídea e enfeites, sofá cinza claro fofo com almofadas, tapete
geométrico azul e cinza, piso de porcelanato claro brilhante, spots de teto quentes.

## `casasimples.png` -> cenário `sala_tijolo`
Casa simples de periferia: paredes de tijolo vermelho aparente (sem reboco), um quadro
de um casarão colonial pendurado no tijolo, sofá marrom de 2 lugares, mesa de madeira
com cadeiras e vaso de flores, tapete estampado sobre piso de cimento, uma lâmpada de
teto forte e crua.

## `quarto.png` -> cenário `quarto`
Quarto moderno aconchegante: colcha branca floral com manta e almofadas rosé,
cabeceira estofada com fita de LED quente, cortinas cinzas, guarda-roupa espelhado,
uma penteadeira/escrivaninha branca, luminária de teto moderna. Clima noturno quente.

## `quintal.png` -> cenário `quintal`
Área externa sob telhado de telha: piso de cerâmica, vaso de planta verde grande, muro
de tijolo vermelho, portão de metal, grama, árvore, tapete de crochê, céu azul de dia
ensolarado. Luz natural forte.

## Roupas
Trocado de "camiseta cinza neutra" (sem graça) pra look casual do dia a dia, variando
cor/estampa a cada geração (`roupaPeca` gênero-aware em `avatar-json.ts`).
