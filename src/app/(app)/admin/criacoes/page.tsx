import type { Metadata } from "next";
import { Sparkles } from "lucide-react";
import { requireAdmin } from "@/lib/dal";
import { getCriacoes, getNomeUsuario } from "@/lib/admin";
import {
  DIAS_CRIACOES_PADRAO,
  PERIODOS_CRIACOES,
  TIPOS_CRIACAO,
  type TipoCriacao,
} from "@/lib/criacoes";
import { AdminCriacoes, type FiltroAtual } from "@/components/app/admin-criacoes";

export const metadata: Metadata = { title: "Admin · Criação dos usuários" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

const POR_LOTE = 60;
const TODOS = TIPOS_CRIACAO.map((t) => t.chave);

export default async function AdminCriacoesPage({
  searchParams,
}: {
  searchParams: Promise<{ u?: string; q?: string; dias?: string; t?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;

  const userId = (sp?.u ?? "").slice(0, 40);
  const busca = (sp?.q ?? "").slice(0, 120);
  const pedido = Number(sp?.dias);
  const dias = PERIODOS_CRIACOES.some((p) => p.v === pedido) ? pedido : DIAS_CRIACOES_PADRAO;
  const pedidos = (sp?.t ?? "").split(",").filter(Boolean) as TipoCriacao[];
  const tipos = pedidos.filter((t) => TODOS.includes(t));
  const tiposFinais = tipos.length ? tipos : TODOS;

  const [{ itens, temMais }, pessoa] = await Promise.all([
    getCriacoes({ userId: userId || undefined, busca, dias, tipos: tiposFinais, limite: POR_LOTE }),
    userId ? getNomeUsuario(userId) : Promise.resolve(null),
  ]);

  const filtro: FiltroAtual = { userId, busca, dias, tipos: tiposFinais };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Sparkles className="size-6 text-primary" />
          Criação dos usuários
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tudo que a galera criou na plataforma (vídeos, imagens e avatares) na ordem em
          que aconteceu. Filtre por pessoa, período e tipo. Vídeo com erro ou ainda
          gerando também aparece, com etiqueta.
        </p>
      </div>

      {/* a chave amarra a galeria ao filtro: mudou o filtro, a lista acumulada
          do "carregar mais" recomeça em vez de misturar resultados */}
      <AdminCriacoes
        key={`${userId}|${busca}|${dias}|${tiposFinais.join(",")}`}
        itens={itens}
        temMais={temMais}
        filtro={filtro}
        pessoa={pessoa}
      />
    </div>
  );
}
