import type { Metadata } from "next";
import { PrivacyPage } from "@/components/PrivacyPage";

export const metadata: Metadata = { title: "კონფიდენციალურობის პოლიტიკა" };

export default function Privacy() {
  return <PrivacyPage />;
}
