import { requireAdmin } from "@/lib/dal";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin(); // só admin entra; senão volta pro /painel
  return <>{children}</>;
}
