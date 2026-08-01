// Influenciadores PRONTOS da plataforma (grátis pra todo mundo): as imagens moram
// em public/avatares. Aparecem em Meus avatares (vitrine), no modo guiado do
// Vídeo com avatar, no picker do Vídeo livre e no Viraliza Lab. Client-safe.
export type AvatarPronto = { id: string; nome: string; src: string };

export const AVATARES_PRONTOS: AvatarPronto[] = [
  { id: "yasmin", nome: "Yasmin", src: "/avatares/yasmin.jpg" },
  { id: "ana", nome: "Ana", src: "/avatares/ana.png" },
  { id: "livia", nome: "Lívia", src: "/avatares/livia.jpg" },
  { id: "giovana", nome: "Giovana", src: "/avatares/giovana.jpg" },
  { id: "juliana", nome: "Juliana", src: "/avatares/juliana.jpg" },
  { id: "helena", nome: "Helena", src: "/avatares/helena.png" },
  { id: "bruna", nome: "Bruna", src: "/avatares/bruna.png" },
  { id: "gabriel", nome: "Gabriel", src: "/avatares/gabriel.png" },
  { id: "diego", nome: "Diego", src: "/avatares/diego.png" },
];
