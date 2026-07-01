"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Atualiza a página a cada N segundos (server refresh) enquanto `ativo` for true.
 * Usado no painel pra ver o status do render mudar sozinho (na_fila -> pronto).
 */
export function AutoAtualizar({
  ativo,
  intervaloMs = 6000,
}: {
  ativo: boolean;
  intervaloMs?: number;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!ativo) return;
    const t = setInterval(() => router.refresh(), intervaloMs);
    return () => clearInterval(t);
  }, [ativo, intervaloMs, router]);

  return null;
}
