import type { Metadata } from "next";
import { JokerHub } from "@/components/JokerHub";

export const metadata: Metadata = { title: "ჯოკერი" };

export default function JokerPage() {
  return <JokerHub />;
}
