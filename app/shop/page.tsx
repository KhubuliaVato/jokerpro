import type { Metadata } from "next";
import { ShopPage } from "@/components/ShopPage";

export const metadata: Metadata = { title: "მაღაზია" };

export default function Shop() {
  return <ShopPage />;
}
