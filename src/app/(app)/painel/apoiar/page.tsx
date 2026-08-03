import type { Metadata } from "next";
import { requireUser } from "@/lib/dal";
import { meusApoios, todosApoios } from "@/lib/apoios";
import { ApoiarPainel } from "@/components/app/apoiar-painel";

export const metadata: Metadata = { title: "Apoie o projeto" };
export const dynamic = "force-dynamic";

export default async function ApoiarPage() {
  const user = await requireUser();
  const admin = user.role === "admin";
  const [meus, todos] = await Promise.all([
    meusApoios(user.id),
    admin ? todosApoios() : Promise.resolve([]),
  ]);
  return <ApoiarPainel admin={admin} meus={meus} todos={todos} />;
}
