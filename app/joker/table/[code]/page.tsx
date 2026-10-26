"use client";

import { useParams } from "next/navigation";
import { OnlineTable } from "@/components/OnlineTable";
import { cleanCode } from "@/lib/online/client";

export default function TablePage() {
  const { code } = useParams<{ code: string }>();
  return <OnlineTable code={cleanCode(code ?? "")} />;
}
