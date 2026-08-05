import type { Metadata } from "next";
import { guardaBiblioteca } from "@/lib/dal";
import { BibliotecaBloqueada } from "@/components/app/biblioteca-bloqueada";
import { MineradorChat } from "@/components/app/minerador-chat";

export const metadata: Metadata = { title: "Minerador de produtos" };
export const dynamic = "force-dynamic";

export default async function MineradorPage() {
  // O Minerador entrega os vídeos da biblioteca, então segue a mesma trava das
  // outras telas de acervo (Virais, Shopee, TikTok): sem assinatura, mostra o erro.
  const { liberado } = await guardaBiblioteca();
  if (!liberado) return <BibliotecaBloqueada />;
  return <MineradorChat />;
}
