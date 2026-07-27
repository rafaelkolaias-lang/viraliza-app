import type { Metadata } from "next";
import { requireUser } from "@/lib/dal";
import { listarMinhasSugestoes, listarTodasSugestoes } from "@/lib/sugestoes";
import { SugestoesPainel } from "@/components/app/sugestoes-painel";

export const metadata: Metadata = { title: "Sugestões e melhorias" };
export const dynamic = "force-dynamic";

export default async function SugestoesPage() {
  const user = await requireUser();
  const admin = user.role === "admin";
  const sugestoes = admin
    ? await listarTodasSugestoes()
    : await listarMinhasSugestoes(user.id);
  return <SugestoesPainel admin={admin} inicial={sugestoes} />;
}
