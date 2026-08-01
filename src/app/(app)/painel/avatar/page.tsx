import { redirect } from "next/navigation";

/**
 * O "Vídeo com avatar" virou o Viraliza Labs: o funil guiado do Lab faz o mesmo
 * caminho com mais controle, e o Vídeo livre e o Gerador de prompt viraram
 * ferramentas do dock de lá. A rota antiga fica de pé só pra não quebrar link
 * salvo, favorito ou mensagem antiga no suporte.
 */
export default function AvatarPage() {
  redirect("/painel/lab");
}
