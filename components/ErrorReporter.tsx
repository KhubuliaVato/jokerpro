"use client";

import { useEffect } from "react";
import { installErrorReporting } from "@/lib/errorReport";

/** Sends the errors of the page to the log the admin panel reads. */
export function ErrorReporter() {
  useEffect(() => {
    installErrorReporting();
  }, []);
  return null;
}
