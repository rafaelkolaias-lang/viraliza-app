// Influenciadores PRONTOS da plataforma (grátis pra todo mundo): as imagens moram
// em public/avatares. Aparecem em Meus avatares (vitrine), no modo guiado do
// Vídeo com avatar, no picker do Vídeo livre e no Viraliza Lab. Client-safe.
//
// `genero` entrou em 06/08/2026 pro "Avatar com produto" NÃO precisar mais
// perguntar o gênero quando a pessoa escolhe um destes: ele é herdado do avatar
// escolhido (os avatares do usuário já guardavam esse campo no banco). Serve só
// pra etiquetar a imagem nova na galeria, não vai pro prompt da IA.
export type AvatarPronto = { id: string; nome: string; src: string; genero: "female" | "male" };

export const AVATARES_PRONTOS: AvatarPronto[] = [
  { id: "yasmin", nome: "Yasmin", src: "/avatares/yasmin.jpg", genero: "female" },
  { id: "ana", nome: "Ana", src: "/avatares/ana.png", genero: "female" },
  { id: "livia", nome: "Lívia", src: "/avatares/livia.jpg", genero: "female" },
  { id: "giovana", nome: "Giovana", src: "/avatares/giovana.jpg", genero: "female" },
  { id: "juliana", nome: "Juliana", src: "/avatares/juliana.jpg", genero: "female" },
  { id: "helena", nome: "Helena", src: "/avatares/helena.png", genero: "female" },
  { id: "bruna", nome: "Bruna", src: "/avatares/bruna.png", genero: "female" },
  { id: "gabriel", nome: "Gabriel", src: "/avatares/gabriel.png", genero: "male" },
  { id: "diego", nome: "Diego", src: "/avatares/diego.png", genero: "male" },
];
