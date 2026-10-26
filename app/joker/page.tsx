import type { Metadata } from "next";
import { JokerApp } from "@/components/JokerApp";

export const metadata: Metadata = { title: "ჯოკერი" };

export default function JokerPage() {
  return <JokerApp />;
}
