import { redirect } from "next/navigation";

/**
 * Aba "Apoie o projeto" DESCONTINUADA (04/08/2026): saiu do menu e o lugar dela
 * virou o Blog. Quem chegar aqui por link antigo cai lá. O restante da doação
 * (lib/apoios, webhook InfinitePay, apoiar-painel.tsx) fica no código só pra
 * histórico dos apoios antigos; nada mais aponta pra cá.
 */
export default function ApoiarPage() {
  redirect("/painel/blog");
}
