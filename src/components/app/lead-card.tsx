"use client";

import { useState } from "react";
import {
  Flame,
  Star,
  Phone,
  Mail,
  Camera,
  Globe,
  MapPin,
  MessageCircle,
  Share2,
  Copy,
  Check,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Lead } from "@/lib/leads";

/** Classifica o lead pela temperatura (mesma régua do scraper). */
function temperatura(score: number) {
  if (score >= 60)
    return { label: "Quente", cor: "text-orange-400", bg: "bg-orange-500/15" };
  if (score >= 30)
    return { label: "Morno", cor: "text-amber-400", bg: "bg-amber-500/15" };
  return { label: "Frio", cor: "text-sky-400", bg: "bg-sky-500/15" };
}

function soDigitos(s: string) {
  return (s || "").replace(/\D/g, "");
}

/** Monta o link de WhatsApp a partir do número (ou do telefone). */
function linkWhatsapp(lead: Lead): string | null {
  let d = soDigitos(lead.whatsapp) || soDigitos(lead.telefone);
  if (!d) return null;
  if (d.length <= 11) d = "55" + d; // adiciona DDI Brasil
  return `https://wa.me/${d}`;
}

function ContatoBtn({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: typeof Phone;
  label: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
    >
      <Icon className="size-3.5" />
      {label}
    </a>
  );
}

export function LeadCard({ lead }: { lead: Lead }) {
  const [abrirMsg, setAbrirMsg] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const t = temperatura(lead.score_lead);
  const wa = linkWhatsapp(lead);
  // Instagram: do campo próprio OU de rede_social (quando o "site" do Maps era um IG).
  const instagram =
    lead.instagram ||
    (/instagram\.com/i.test(lead.rede_social) ? lead.rede_social : "");
  // Outra rede social (Facebook, Linktree, etc.) que não seja Instagram.
  const outraRede =
    lead.rede_social && !/instagram\.com/i.test(lead.rede_social)
      ? lead.rede_social
      : "";
  const oportunidades = lead.oportunidades
    ? lead.oportunidades.split(",").map((o) => o.trim()).filter(Boolean)
    : [];

  async function copiarMsg() {
    try {
      await navigator.clipboard.writeText(lead.mensagem_sugerida);
      setCopiado(true);
      toast.success("Mensagem copiada!");
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      toast.error("Não consegui copiar.");
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      {/* topo: nome + score */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold leading-tight">{lead.nome}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {lead.categoria || lead.nicho}
            {lead.cidade && ` · ${lead.cidade}`}
            {lead.uf && ` - ${lead.uf}`}
          </p>
        </div>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold",
            t.bg,
            t.cor,
          )}
          title={`Score ${lead.score_lead}`}
        >
          <Flame className="size-3" />
          {t.label}
        </span>
      </div>

      {/* nota + avaliações + sem site */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {lead.nota != null && (
          <span className="inline-flex items-center gap-1">
            <Star className="size-3.5 fill-amber-400 text-amber-400" />
            {lead.nota.toLocaleString("pt-BR")} ({lead.total_avaliacoes})
          </span>
        )}
        {!lead.site && (
          <span className="inline-flex items-center gap-1 font-medium text-orange-400">
            <Globe className="size-3.5" />
            Sem site
          </span>
        )}
      </div>

      {/* oportunidades */}
      {oportunidades.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {oportunidades.map((o) => (
            <span
              key={o}
              className="rounded-full bg-primary/12 px-2 py-0.5 text-[11px] font-medium text-primary"
            >
              {o}
            </span>
          ))}
        </div>
      )}

      {/* contatos */}
      <div className="flex flex-wrap gap-1.5">
        {wa && <ContatoBtn href={wa} icon={MessageCircle} label="WhatsApp" />}
        {lead.telefone && (
          <ContatoBtn
            href={`tel:${soDigitos(lead.telefone)}`}
            icon={Phone}
            label={lead.telefone}
          />
        )}
        {lead.email && (
          <ContatoBtn href={`mailto:${lead.email}`} icon={Mail} label="E-mail" />
        )}
        {instagram && (
          <ContatoBtn href={instagram} icon={Camera} label="Instagram" />
        )}
        {outraRede && (
          <ContatoBtn href={outraRede} icon={Share2} label="Rede social" />
        )}
        {lead.site && (
          <ContatoBtn href={lead.site} icon={Globe} label="Site" />
        )}
        {lead.google_maps && (
          <ContatoBtn href={lead.google_maps} icon={MapPin} label="Maps" />
        )}
      </div>

      {/* mensagem sugerida */}
      {lead.mensagem_sugerida && (
        <div className="rounded-lg border border-border bg-background">
          <button
            type="button"
            onClick={() => setAbrirMsg((v) => !v)}
            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-xs font-medium"
          >
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <MessageCircle className="size-3.5" />
              Mensagem de abordagem
            </span>
            <ChevronDown
              className={cn(
                "size-4 text-muted-foreground transition-transform",
                abrirMsg && "rotate-180",
              )}
            />
          </button>
          {abrirMsg && (
            <div className="space-y-2 border-t border-border p-3">
              <p className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                {lead.mensagem_sugerida}
              </p>
              <button
                type="button"
                onClick={copiarMsg}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
              >
                {copiado ? (
                  <Check className="size-3.5" />
                ) : (
                  <Copy className="size-3.5" />
                )}
                {copiado ? "Copiado" : "Copiar mensagem"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
