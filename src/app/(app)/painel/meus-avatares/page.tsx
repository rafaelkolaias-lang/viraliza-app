import type { Metadata } from "next";
import { MeusAvatares } from "@/components/app/meus-avatares";
import { requireUser } from "@/lib/dal";
import { listarAvatares } from "@/lib/avatares";

export const metadata: Metadata = { title: "Galeria de avatares" };
export const dynamic = "force-dynamic";

export default async function MeusAvataresPage() {
  const user = await requireUser();
  const avatares = await listarAvatares(user.id);
  return <MeusAvatares avataresIniciais={avatares} />;
}
