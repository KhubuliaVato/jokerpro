import { redirect } from "next/navigation";

/** Nardi is not open yet: the page (and its code in components/NardiApp.tsx) waits for the launch. */
export default function NardiPage() {
  redirect("/");
}
