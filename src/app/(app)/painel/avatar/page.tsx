import type { Metadata } from "next";
import { AvatarEstudio } from "@/components/app/avatar-estudio";
import { requireUser } from "@/lib/dal";
import { listarAvatares } from "@/lib/avatares";

export const metadata: Metadata = { title: "Vídeo com avatar" };
export const dynamic = "force-dynamic";

export default async function AvatarPage() {
  const user = await requireUser();
  const meusAvatares = await listarAvatares(user.id);
  return <AvatarEstudio meusAvatares={meusAvatares} admin={user.role === "admin"} />;
}
