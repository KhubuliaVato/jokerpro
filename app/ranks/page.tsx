import type { Metadata } from "next";
import { RanksPage } from "@/components/RanksPage";

export const metadata: Metadata = { title: "წოდებები" };

export default function Ranks() {
  return <RanksPage />;
}
