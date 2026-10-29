import type { Metadata } from "next";
import { PokerHub } from "@/components/PokerHub";

export const metadata: Metadata = { title: "პოკერი" };

export default function PokerPage() {
  return <PokerHub />;
}
