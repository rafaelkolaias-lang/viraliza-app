# Prompts — Conjunto Brasil L'Olive (cenários do Rio)

> Produto: cropped amarelo com estampa "BRASIL" + bandeira e detalhe verde,
> + short de cós alto amarelo/verde (vibe fitness/sporty). Modelagem que valoriza
> curvas, não fica transparente. Marca L'Olive. Tam 36-40 (short) / 36-44 (saia).
> Objetivo: modelo nos cenários icônicos do Rio (Copacabana pôr do sol, Cristo, etc).

## Fluxo de 2 passos
1. **Imagem (trocar fundo):** numa IA de edição (Nano Banana / Flux Kontext / Seedream /
   Midjourney), troca o cenário mantendo modelo + roupa idênticas.
2. **Vídeo (animar):** image-to-video na imagem nova, com movimento natural.

> Use SEMPRE a mesma foto-base (corpo inteiro, rosto à mostra) p/ a modelo ficar
> consistente em todos os cenários. Inclua "fully clothed, tasteful" (evita ban / IA viajar).

---

## PASSO 1 — Trocar o fundo (imagem)

**Template EN:**
```
Place this same woman wearing the yellow and green "BRASIL" crop top and matching
high-waisted shorts into {LOCAL}. Keep her face, body, hair, tattoos and the outfit
exactly the same and unchanged. Photorealistic, natural lighting that matches the
scene, full-body vertical 9:16 shot, tasteful and fully clothed.
```

**Negative:** `nudity, distorted body, deformed hands, changed outfit, warped text, extra limbs, low quality, watermark`

---

## PASSO 2 — Animar (vídeo)

**Template EN:**
```
Vertical 9:16 fashion video. A young Brazilian woman wearing a yellow and green
"BRASIL" crop top and matching high-waisted shorts at {LOCAL}. Natural movement:
her long hair flows gently in the breeze, she smiles and slowly turns posing
confidently; slow cinematic camera push-in, golden hour light. Fully clothed,
tasteful, photorealistic, high detail, 4k.
```

**Negative:** `nudity, distorted body, deformed legs, extra limbs, fast motion, glitch, low quality, watermark`

---

## Cenários prontos ({LOCAL})

1. **Copacabana pôr do sol**
   `Copacabana beach in Rio de Janeiro at golden sunset, gentle ocean waves and sea breeze behind her, warm orange sky`

2. **Cristo Redentor**
   `the Christ the Redeemer viewpoint in Rio de Janeiro, the statue and green mountains in the background, bright daylight`

3. **Pão de Açúcar**
   `the Sugarloaf Mountain viewpoint with Guanabara Bay and Rio skyline behind her, late afternoon light`

4. **Calçadão de Copacabana**
   `the famous Copacabana boardwalk with its black-and-white wave-pattern pavement and palm trees, sunny day`

5. **Praia + bola de futebol** (vibe esporte)
   `a sunny Rio de Janeiro beach with a football on the sand, blue sky, sporty summer vibe`

## Roteiro de narração (vibe atitude — ajustar no narrar_video.py)
"Olha que conjunto perfeito pra você arrasar... O cropped Brasil realça a silhueta,
o short de cós alto modela o corpo e não fica transparente. Tecido macio e com a
elasticidade ideal. Perfeito pros jogos, pros rolês e pras suas produções. Estoque
limitado, corre no link!"
