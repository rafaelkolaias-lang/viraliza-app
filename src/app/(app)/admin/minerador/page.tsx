import type { Metadata } from "next";
import { MineradorChat } from "@/components/app/minerador-chat";

export const metadata: Metadata = { title: "Admin · Minerador" };
export const dynamic = "force-dynamic";

export default function MineradorPage() {
  return <MineradorChat />;
}
