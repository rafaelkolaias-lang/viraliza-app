/**
 * Validação de CPF (dígitos verificadores). O Pix do Mercado Pago exige o CPF do
 * pagador, e CPF errado volta como um erro genérico da API, que na tela vira
 * "não consegui gerar o QR" sem a pessoa saber o que corrigir. Conferir aqui deixa
 * o erro no campo certo.
 *
 * Client-safe de propósito: a mesma função valida no navegador e no servidor.
 */
export function cpfValido(entrada: string): boolean {
  const cpf = (entrada || "").replace(/\D/g, "");
  if (cpf.length !== 11) return false;
  // 111.111.111-11 e afins passam na conta dos dígitos, mas não existem
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const digito = (ate: number) => {
    let soma = 0;
    for (let i = 0; i < ate; i++) soma += Number(cpf[i]) * (ate + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return digito(9) === Number(cpf[9]) && digito(10) === Number(cpf[10]);
}

/** 000.000.000-00 enquanto a pessoa digita. */
export function formatarCpf(entrada: string): string {
  const d = (entrada || "").replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
}
