import type { Metadata } from "next";
import { PlayerPage } from "@/components/PlayerPage";

export const metadata: Metadata = { title: "მოთამაშე" };

export default function Player() {
  return <PlayerPage />;
}
