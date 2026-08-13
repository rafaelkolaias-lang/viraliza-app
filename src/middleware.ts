import { NextResponse, type NextRequest } from "next/server";

/**
 * Porta dos ARQUIVOS ESTÁTICOS sensíveis (auditoria #31 e #37).
 *
 * Os vídeos gerados e o material da biblioteca moram em `public/`, e o Next
 * serve `public/` direto - então quem tivesse o endereço cru (`/videos/...`,
 * `/virais/...`) baixava passando por fora da tela. O #31 fechou o "sem login",
 * mas o middleware roda no edge (sem banco) e só conseguia checar o login: dava
 * pra baixar o vídeo de OUTRO usuário e a biblioteca inteira SEM assinatura,
 * bastando estar logado (auditoria #37).
 *
 * A correção: em vez de servir o arquivo cru, o middleware REESCREVE o pedido
 * pra rota `/api/midia/[...slug]`, que roda em node com Prisma e aplica a regra
 * fina (dono do vídeo; assinatura pra virais/produtos/downloads; admin e demo
 * passam; voice-previews só exige login). É a MESMA rota por onde as telas já
 * pedem mídia, então o comportamento fica igual pros dois caminhos. Login,
 * assinatura, dono e conta bloqueada passam a valer também no endereço cru.
 */
export function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  url.pathname = `/api/midia${url.pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: [
    "/videos/:path*",
    "/downloads/:path*",
    "/virais/:path*",
    "/produtos/:path*",
    "/voice-previews/:path*",
  ],
};
