"use client";

import { notFound, useParams } from "next/navigation";
import { BuraApp } from "@/components/BuraApp";
import { FormatPicker } from "@/components/FormatPicker";
import { PrivateRoom } from "@/components/PrivateRoom";

/** /bura/ranked, /bura/friendly, /bura/private and /bura/bots. */
export default function BuraModePage() {
  const { mode } = useParams<{ mode: string }>();
  if (mode === "ranked") return <FormatPicker kind="ranked" game="bura" />;
  if (mode === "friendly") return <FormatPicker kind="friendly" game="bura" />;
  if (mode === "private") return <PrivateRoom game="bura" />;
  if (mode === "bots") return <BuraApp />;
  notFound();
}
