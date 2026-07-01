#!/bin/sh
set -e

# Garante as pastas de dados (montadas como volume no EasyPanel)
mkdir -p /app/data/uploads /app/public/videos /app/public/virais /app/public/produtos /app/public/downloads

# Cria/atualiza as tabelas no banco (idempotente)
echo "→ aplicando schema no banco..."
npx prisma db push --skip-generate --accept-data-loss

# Migração única SQLite -> MySQL (idempotente; só roda se houver prod.db antigo
# e o MySQL ainda estiver vazio). node:sqlite precisa da flag experimental no Node 22.
echo "→ migrando dados do SQLite antigo (se houver)..."
node --experimental-sqlite prisma/migra-sqlite-mysql.mjs || echo "  (migração pulada/falhou — segue o boot)"

echo "→ subindo o Viraliza na porta ${PORT:-3000}..."
exec npm run start -- -H 0.0.0.0 -p "${PORT:-3000}"
