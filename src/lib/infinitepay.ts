import "server-only";

/**
 * Checkout da InfinitePay, usado só pelas DOAÇÕES de apoio ao projeto.
 *
 * Duas coisas importantes sobre essa API:
 *
 * 1. O POST que cria o link NÃO tem autenticação. Isso é da InfinitePay, não é
 *    esquecimento nosso: o handle é público mesmo, e criar um link só serve pra
 *    alguém te PAGAR.
 *
 * 2. O webhook TAMBÉM não é assinado. Logo, ele não pode ser acreditado: quem
 *    diz se o dinheiro entrou é o `payment_check`. O webhook só avisa "olha, dá
 *    uma conferida nesse aqui". É a mesma disciplina do webhook da Cakto.
 */

const API = "https://api.checkout.infinitepay.io";
// a InfiniteTag da conta, SEM o "$" do começo (é assim que a API espera)
const HANDLE = (process.env.INFINITEPAY_HANDLE || "").replace(/^\$/, "");
const APP = (process.env.APP_URL || "https://www.viraliza.app.br").replace(/\/$/, "");

export function infinitepayConfigurada() {
  return !!HANDLE;
}

export type LinkApoio = { url: string };

/**
 * Cria o link de pagamento. O `orderNsu` é a nossa chave: é ele que volta no
 * webhook e diz de qual apoio (e de qual usuário) o pagamento é.
 */
export async function criarLinkApoio(opts: {
  orderNsu: string;
  valorCentavos: number;
  nome?: string | null;
  email?: string | null;
}): Promise<LinkApoio | null> {
  if (!infinitepayConfigurada()) return null;

  const corpo = {
    handle: HANDLE,
    order_nsu: opts.orderNsu,
    redirect_url: `${APP}/painel/apoiar?obrigado=1`,
    webhook_url: `${APP}/api/infinitepay/webhook`,
    items: [
      {
        quantity: 1,
        price: opts.valorCentavos, // em centavos
        description: "Apoio ao Viraliza",
      },
    ],
    ...(opts.nome || opts.email
      ? { customer: { name: opts.nome || undefined, email: opts.email || undefined } }
      : {}),
  };

  try {
    const res = await fetch(`${API}/links`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
      cache: "no-store",
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.error("[infinitepay] falha ao criar link", res.status, txt.slice(0, 300));
      return null;
    }
    const data = (await res.json()) as { url?: string };
    return data?.url ? { url: data.url } : null;
  } catch (e) {
    console.error("[infinitepay] erro de rede ao criar link", e);
    return null;
  }
}

/**
 * A ÚNICA fonte da verdade sobre o pagamento. Só devolve true quando a própria
 * InfinitePay confirma. Qualquer dúvida (erro de rede, resposta estranha,
 * status desconhecido) devolve false: é melhor deixar um apoio real como
 * "aguardando" do que marcar como pago algo que não entrou.
 */
export async function pagamentoConfirmado(opts: {
  orderNsu: string;
  transactionNsu?: string | null;
  slug?: string | null;
}): Promise<boolean> {
  if (!infinitepayConfigurada()) return false;

  try {
    const res = await fetch(`${API}/payment_check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        handle: HANDLE,
        order_nsu: opts.orderNsu,
        transaction_nsu: opts.transactionNsu || undefined,
        slug: opts.slug || undefined,
      }),
      cache: "no-store",
    });
    if (!res.ok) {
      console.error("[infinitepay] payment_check respondeu", res.status, opts.orderNsu);
      return false;
    }
    const data = (await res.json()) as {
      success?: boolean;
      paid?: boolean;
      status?: string;
    };
    // a API pode responder de mais de um jeito conforme a versão; aceita só o
    // que for afirmativo de verdade
    const status = String(data?.status || "").toLowerCase();
    return (
      data?.success === true ||
      data?.paid === true ||
      status === "paid" ||
      status === "approved" ||
      status === "success"
    );
  } catch (e) {
    console.error("[infinitepay] erro de rede no payment_check", opts.orderNsu, e);
    return false;
  }
}
