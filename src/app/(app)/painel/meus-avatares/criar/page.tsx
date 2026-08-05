import type { Metadata } from "next";
import { CriarInfluenciador } from "@/components/app/criar-influenciador";
import { requireUser } from "@/lib/dal";
import { listarAvatares } from "@/lib/avatares";

export const metadata: Metadata = { title: "Novo influenciador" };
export const dynamic = "force-dynamic";

export default async function CriarAvatarPage() {
  const user = await requireUser();
  // a lista é usada pelo caminho "junto com um produto", que deixa escolher
  // qual influenciador seu vai segurar o produto
  const avatares = await listarAvatares(user.id);
  return <CriarInfluenciador avatares={avatares} admin={user.role === "admin"} />;
}
