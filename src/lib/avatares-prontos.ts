// Avatares PRONTOS da plataforma (grátis pra todo mundo): as imagens moram em
// public/avatares. Aparecem em Meus avatares (vitrine), no modo guiado do
// Vídeo com avatar e no picker do Vídeo livre. Client-safe de propósito.
export type AvatarPronto = { id: string; nome: string; src: string };

export const AVATARES_PRONTOS: AvatarPronto[] = [
  { id: "yasmin", nome: "Yasmin", src: "/avatares/yasmin.jpg" },
  { id: "ana", nome: "Ana", src: "/avatares/ana.png" },
  { id: "lucas", nome: "Lucas", src: "/avatares/lucas.png" },
  { id: "cleide", nome: "Cleide", src: "/avatares/cleide.png" },
  { id: "isabela", nome: "Isabela", src: "/avatares/isabela.png" },
  { id: "marina", nome: "Marina", src: "/avatares/marina.png" },
  { id: "taina", nome: "Tainá", src: "/avatares/taina.png" },
  { id: "jefferson", nome: "Jefferson", src: "/avatares/jefferson.png" },
  { id: "rodrigo", nome: "Rodrigo", src: "/avatares/rodrigo.png" },
];
