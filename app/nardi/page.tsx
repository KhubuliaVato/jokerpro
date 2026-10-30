import type { Metadata } from "next";
import { NardiApp } from "@/components/NardiApp";

export const metadata: Metadata = { title: "ნარდი" };

export default function NardiPage() {
  return <NardiApp />;
}
