"use client";

import { notFound, useParams } from "next/navigation";
import { FormatPicker } from "@/components/FormatPicker";
import { JokerApp } from "@/components/JokerApp";
import { PrivateRoom } from "@/components/PrivateRoom";

/** /joker/ranked, /joker/friendly, /joker/private and /joker/bots. */
export default function JokerModePage() {
  const { mode } = useParams<{ mode: string }>();
  if (mode === "ranked") return <FormatPicker kind="ranked" />;
  if (mode === "friendly") return <FormatPicker kind="friendly" />;
  if (mode === "private") return <PrivateRoom />;
  if (mode === "bots") return <JokerApp />;
  notFound();
}
