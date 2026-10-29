"use client";

import { notFound, useParams } from "next/navigation";
import { PokerApp } from "@/components/PokerApp";
import { PrivateRoom } from "@/components/PrivateRoom";

/** /poker/private (friends, online) and /poker/bots. */
export default function PokerModePage() {
  const { mode } = useParams<{ mode: string }>();
  if (mode === "private") return <PrivateRoom game="poker" />;
  if (mode === "bots") return <PokerApp />;
  notFound();
}
