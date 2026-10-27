import type { Metadata } from "next";
import { ModeHub } from "@/components/ModeHub";

export const metadata: Metadata = { title: "ჯოკერი" };

export default function JokerPage() {
  return <ModeHub game="joker" />;
}
