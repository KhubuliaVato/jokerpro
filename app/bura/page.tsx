import type { Metadata } from "next";
import { ModeHub } from "@/components/ModeHub";

export const metadata: Metadata = { title: "ბურა" };

export default function BuraPage() {
  return <ModeHub game="bura" />;
}
