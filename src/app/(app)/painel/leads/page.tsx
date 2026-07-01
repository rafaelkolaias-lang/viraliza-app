import type { Metadata } from "next";
import { MapPin } from "lucide-react";
import { LeadsPainel } from "@/components/app/leads-painel";
import { getLeads } from "@/lib/leads";
import { requireUser } from "@/lib/dal";

export const metadata: Metadata = { title: "MapsLeads" };
export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const user = await requireUser();
  const leads = await getLeads(user.id);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <MapPin className="size-6 text-primary" />
          MapsLeads
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Empresas garimpadas no Google Maps, ranqueadas do lead mais quente pro
          mais frio - com contatos e mensagem de abordagem pronta.
        </p>
      </div>
      <LeadsPainel leads={leads} />
    </div>
  );
}
