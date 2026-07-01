import { z } from "zod";

// Regex simples de e-mail - independe da versão do zod.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const cadastroSchema = z.object({
  nome: z.string().trim().min(2, "Digite seu nome."),
  email: z.string().trim().toLowerCase().regex(EMAIL, "E-mail inválido."),
  senha: z.string().min(6, "A senha precisa de pelo menos 6 caracteres."),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().regex(EMAIL, "E-mail inválido."),
  senha: z.string().min(1, "Digite sua senha."),
});
