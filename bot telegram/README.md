# 🔥 Bot Telegram — Vídeos Virais

Baixa vídeos novos de canais/grupos do Telegram (onde **você é membro**) e disponibiliza
na web, na página **Vídeos virais** — com o **link do produto** junto. Sem perder qualidade.

## Setup (uma vez)

1. Acesse https://my.telegram.org → **API development tools** e crie um app.
   Anote o **API ID** e o **API Hash**.
2. No `.env` da **raiz** do projeto, adicione:
   ```
   TELEGRAM_API_ID=123456
   TELEGRAM_API_HASH=seu_hash_aqui
   TELEGRAM_CANAIS=@canal_de_virais,@outro_canal
   ```
   (use @ do canal/grupo, ou o id; precisa ser membro)
3. Instale as dependências:
   ```
   pip install -r requirements.txt
   ```

## Rodar

```
python baixar_virais.py                 # baixa histórico recente e fica OUVINDO novos
python baixar_virais.py --historico 200 # baixa as últimas 200 de cada canal e sai
```

Na primeira execução o Telegram pede seu **telefone + código** (login normal). Depois fica
salvo na sessão (`sessao_virais`).

## O que ele faz

- ✅ Detecta **FloodWait** (limite de velocidade) e espera o tempo certo, sem quebrar.
- ✅ **Não rebaixa** o mesmo vídeo (tracker em `baixados.json`).
- ✅ Extrai o **link do produto** e um **título** da legenda.
- ✅ Modo **ao vivo**: vídeo novo no canal → baixa na hora.
- ✅ Salva em `app/public/virais/*.mp4` e os dados em `app/data/virais.json`
  (a web lê isso automaticamente).

## Saída

- Vídeos: `../app/public/virais/tg_<canal>_<id>.mp4`
- Metadados: `../app/data/virais.json` (id, título, link, arquivo, duração, data)

> ⚠️ Baixe apenas conteúdo que você tem direito de usar / é membro do canal.
