import type { Metadata } from "next";
import { AdminPage } from "@/components/AdminPage";

export const metadata: Metadata = { title: "ადმინი", robots: { index: false, follow: false } };

export default function Admin() {
  return <AdminPage />;
}
