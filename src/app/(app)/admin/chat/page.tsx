import type { Metadata } from "next";
import { MessageCircle } from "lucide-react";
import { requireAdmin } from "@/lib/dal";
import { AdminChat } from "@/components/app/admin-chat";

export const metadata: Metadata = { title: "Admin · Chat" };
export const dynamic = "force-dynamic";

export default async function AdminChatPage() {
  await requireAdmin();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <MessageCircle className="size-6 text-primary" />
          Chat
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Converse com qualquer pessoa da plataforma. Só você inicia: ao mandar a
          primeira mensagem, a caixinha aparece pra ela no painel (texto e áudio).
        </p>
      </div>
      <AdminChat />
    </div>
  );
}
