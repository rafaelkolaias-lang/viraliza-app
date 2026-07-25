"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Camera, Gift, Check, X, Loader2, Heart, MessageCircle, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  INSTAGRAM_URL,
  INSTAGRAM_HANDLE,
  BONUS_IG_CREDITOS,
  type StatusBonusIg,
} from "@/lib/promos";

/**
 * Modal "Ganhe 300 créditos por seguir o Instagram". Abre 1x por sessão pra quem
 * ainda não pediu (ou foi recusado). A pessoa segue, curte e comenta, informa o @
 * dela e envia: o pedido fica pendente e o admin aprova depois (aí os créditos caem).
 */
export function ModalInstagramBonus({ status }: { status: StatusBonusIg }) {
  const [aberto, setAberto] = useState(false);
  const [instagram, setInstagram] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(status === "pendente");

  // Abre sozinho a CADA entrada pra quem ainda não pediu (nenhum) ou foi recusado.
  // Só para de aparecer quando o admin APROVA (aí status vira "aprovado"). Pendente
  // não reabre (a pessoa já mandou o @ e está esperando a aprovação). Fechar vale
  // só pra esta sessão de navegação; ao entrar de novo (recarregar/logar), reaparece.
  useEffect(() => {
    if (status !== "nenhum" && status !== "recusado") return;
    const t = setTimeout(() => setAberto(true), 900);
    return () => clearTimeout(t);
  }, [status]);

  // quem já foi aprovado não vê o modal (já pegou o bônus).
  if (status === "aprovado") return null;

  function fechar() {
    setAberto(false);
  }

  async function enviar() {
    setErro(null);
    if (instagram.replace(/[@\s]/g, "").length < 2) {
      setErro("Digite seu @ do Instagram.");
      return;
    }
    setEnviando(true);
    try {
      const r = await fetch("/api/bonus-instagram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instagram }),
      });
      const data = (await r.json().catch(() => ({}))) as { erro?: string };
      if (!r.ok) {
        setErro(data.erro || "Não consegui enviar. Tente de novo.");
        return;
      }
      setEnviado(true);
    } catch {
      setErro("Sem conexão. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog.Root open={aberto} onOpenChange={(o) => (o ? setAberto(true) : fechar())}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm transition-opacity duration-300 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-border bg-card shadow-2xl transition-all duration-300 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
          {/* topo com gradiente do Instagram */}
          <div className="relative overflow-hidden px-6 pt-8 pb-6 text-center">
            <div
              className="absolute inset-0 opacity-90"
              style={{
                background:
                  "linear-gradient(135deg, rgba(240,148,51,0.22) 0%, rgba(230,104,60,0.20) 25%, rgba(220,39,67,0.20) 50%, rgba(204,35,102,0.20) 75%, rgba(88,81,219,0.22) 100%)",
              }}
            />
            <div className="relative mx-auto grid size-16 place-items-center rounded-2xl bg-gradient-to-br from-[#f09433] via-[#dc2743] to-[#5851db] text-white shadow-lg">
              <Camera className="size-8" />
            </div>
            <Dialog.Title className="relative mt-4 text-2xl font-bold tracking-tight">
              Ganhe {BONUS_IG_CREDITOS} créditos! 🎁
            </Dialog.Title>
            <Dialog.Description className="relative mx-auto mt-2 max-w-xs text-sm text-muted-foreground">
              Siga a gente no Instagram, curta e comente na última publicação. É
              rapidinho e rende {BONUS_IG_CREDITOS} créditos na sua conta.
            </Dialog.Description>
          </div>

          <div className="px-6 pb-6">
            {enviado ? (
              // estado: pedido enviado, em análise
              <div className="rounded-2xl border border-primary/25 bg-primary/10 px-4 py-5 text-center">
                <span className="mx-auto grid size-12 place-items-center rounded-full bg-primary text-primary-foreground">
                  <Check className="size-6" strokeWidth={3} />
                </span>
                <p className="mt-3 font-semibold text-foreground">Pedido enviado!</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Vamos conferir e liberar seus {BONUS_IG_CREDITOS} créditos em
                  breve. Você recebe um aviso no sininho quando cair. 🔔
                </p>
                <Button variant="ghost" className="mt-3 w-full" onClick={fechar}>
                  Fechar
                </Button>
              </div>
            ) : (
              <>
                {/* passos */}
                <ul className="space-y-2.5">
                  {[
                    { Icon: UserPlus, txt: `Siga o ${INSTAGRAM_HANDLE}` },
                    { Icon: Heart, txt: "Curta a última publicação" },
                    { Icon: MessageCircle, txt: "Deixe um comentário" },
                  ].map(({ Icon, txt }, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm">
                      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-foreground">
                        <Icon className="size-4" />
                      </span>
                      {txt}
                    </li>
                  ))}
                </ul>

                {/* abrir o instagram */}
                <Button
                  variant="outline"
                  className="mt-4 h-11 w-full"
                  render={
                    <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" />
                  }
                >
                  <Camera className="size-4" />
                  Abrir o Instagram
                </Button>

                {/* @ da pessoa */}
                <div className="mt-4">
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    Seu @ do Instagram
                  </label>
                  <div className="flex items-center rounded-xl border border-border bg-background px-3 focus-within:border-primary">
                    <span className="text-muted-foreground">@</span>
                    <input
                      value={instagram}
                      onChange={(e) => setInstagram(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && enviar()}
                      placeholder="seuusuario"
                      className="w-full bg-transparent py-2.5 pl-1 text-sm outline-none placeholder:text-muted-foreground"
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Precisamos do seu @ pra confirmar que você seguiu.
                  </p>
                  {erro && <p className="mt-1.5 text-xs text-red-500">{erro}</p>}
                </div>

                <Button
                  size="lg"
                  className="mt-4 h-12 w-full text-base"
                  onClick={enviar}
                  disabled={enviando}
                >
                  {enviando ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : (
                    <Gift className="size-5" />
                  )}
                  Já segui, quero meus {BONUS_IG_CREDITOS} créditos
                </Button>
                <Button variant="ghost" className="mt-2 w-full" onClick={fechar}>
                  Agora não
                </Button>
              </>
            )}
          </div>

          <Dialog.Close
            render={<Button variant="ghost" size="icon-sm" className="absolute right-3 top-3" />}
          >
            <X className="size-4" />
            <span className="sr-only">Fechar</span>
          </Dialog.Close>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
