import type { Metadata } from "next";
import { LeaderboardPage } from "@/components/LeaderboardPage";

export const metadata: Metadata = { title: "ლიდერბორდი" };

export default function Leaderboard() {
  return <LeaderboardPage />;
}
