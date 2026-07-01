import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { getCurrentUser } from "@/lib/dal";
import { mapearLead, salvarLeads } from "@/lib/leads";
import { temSaldo, debitarClamp } from "@/lib/creditos";
import { CREDITOS_FIXO } from "@/lib/precos";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Pasta do scraper MapsLeads (roda local, no PC). É aqui que o .json é salvo.
const SCRAPER_DIR =
  "C:\\Users\\lucas\\OneDrive\\Área de Trabalho\\MapsLeads\\scraper";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Não autorizado", { status: 401 });
  if (user.role === "demo")
    return new Response("Conta demo não roda buscas", { status: 403 });

  // Trava de crédito: produção exige crédito (admin passa direto).
  if (user.role !== "admin" && !(await temSaldo(user.id)))
    return new Response(
      "Você precisa de créditos pra buscar leads. Compre na aba Créditos.",
      { status: 402 },
    );

  const body = (await req.json().catch(() => ({}))) as {
    cidade?: string;
    uf?: string;
    nichos?: string[];
    qtd?: number;
  };

  const cidade = (body.cidade || "").trim();
  const uf = (body.uf || "").trim();
  const nichos = Array.isArray(body.nichos) ? body.nichos.filter(Boolean) : [];
  const qtd = Math.min(Math.max(Number(body.qtd) || 20, 1), 300);
  if (!cidade) return new Response("Informe a cidade", { status: 400 });

  const cidadeArg = uf ? `${cidade} - ${uf}` : cidade;
  const args = [
    "buscador_leads.py",
    "--cidade",
    cidadeArg,
    "--qtd",
    String(qtd),
    "--headless",
  ];
  if (nichos.length) args.push("--nichos", nichos.join(","));
  else args.push("--garimpo");

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let fechado = false;
      const send = (obj: unknown) => {
        if (fechado) return;
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      };
      const fechar = () => {
        if (fechado) return;
        fechado = true;
        try {
          controller.close();
        } catch {
          /* já fechado */
        }
      };

      send({ type: "progress", msg: `Iniciando busca em ${cidadeArg}...` });

      let jsonPath = "";
      let buf = "";

      const processarLinha = (line: string) => {
        const t = line.trim();
        if (!t) return;
        const m = /JSON salvo em:\s*(.+)$/.exec(t);
        if (m) jsonPath = m[1].trim();
        send({ type: "progress", msg: t });
      };

      const aoFechar = async (code: number | null) => {
        try {
          let full = jsonPath;
          if (full && !path.isAbsolute(full)) full = path.join(SCRAPER_DIR, full);
          if (!full || !fs.existsSync(full)) {
            send({
              type: "error",
              msg:
                code === 0
                  ? "Busca terminou, mas não achei o arquivo de resultados."
                  : `Nenhum lead encontrado (a busca pode não ter retornado nada).`,
            });
            fechar();
            return;
          }
          const payload = JSON.parse(fs.readFileSync(full, "utf-8"));
          const cru = Array.isArray(payload) ? payload : payload?.leads || [];
          const leads = cru.map(mapearLead);

          // persiste no banco (upsert por chave) antes de devolver
          send({ type: "progress", msg: `Salvando ${leads.length} leads no banco...` });
          try {
            await salvarLeads(leads, user.id);
          } catch {
            send({ type: "progress", msg: "(aviso: não consegui salvar no banco)" });
          }

          // débito (preço fixo de processamento) — só pra quem paga (admin não)
          if (leads.length > 0 && user.role !== "admin") {
            await debitarClamp(user.id, CREDITOS_FIXO.leads, "debito_processamento", {
              descricao: "Busca de leads",
            }).catch(() => {});
          }

          send({ type: "done", leads });
        } catch (e) {
          send({
            type: "error",
            msg: `Erro lendo resultados: ${(e as Error).message}`,
          });
        }
        fechar();
      };

      const ligar = (cmd: string, ehFallback: boolean) => {
        let proc: ChildProcessWithoutNullStreams;
        try {
          proc = spawn(cmd, args, {
            cwd: SCRAPER_DIR,
            env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUNBUFFERED: "1" },
          });
        } catch {
          if (!ehFallback) return ligar("py", true);
          send({ type: "error", msg: "Não consegui iniciar o Python." });
          fechar();
          return;
        }

        proc.stdout.on("data", (d: Buffer) => {
          buf += d.toString("utf-8");
          let idx: number;
          while ((idx = buf.indexOf("\n")) >= 0) {
            processarLinha(buf.slice(0, idx));
            buf = buf.slice(idx + 1);
          }
        });
        proc.stderr.on("data", (d: Buffer) => {
          const t = d.toString("utf-8").trim();
          if (t) send({ type: "progress", msg: t });
        });
        proc.on("error", (err: NodeJS.ErrnoException) => {
          if (err.code === "ENOENT" && !ehFallback) {
            ligar("py", true); // tenta o launcher do Windows
            return;
          }
          send({ type: "error", msg: `Falha ao rodar o robô: ${err.message}` });
          fechar();
        });
        proc.on("close", aoFechar);
      };

      ligar("python", false);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
