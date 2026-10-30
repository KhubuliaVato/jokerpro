"use client";

import { setCurrentLang, tt, type Lang, type T } from "./lang";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export const LANGS: { id: Lang; label: string }[] = [
  { id: "ka", label: "ქართული" },
  { id: "en", label: "English" },
  { id: "ru", label: "Русский" },
];

const KEY = "lang";

interface Ctx {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: T;
}

const LangContext = createContext<Ctx>({ lang: "ka", setLang: () => {}, t: (ka) => ka });

export function LangProvider({ children }: { children: ReactNode }) {
  // Georgian first, on the server and on the first client render; a saved choice is applied right after.
  const [lang, setLangState] = useState<Lang>("ka");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- the saved choice is only readable in the browser
      if (saved === "en" || saved === "ru") setLangState(saved);
    } catch {
      // storage can be blocked; Georgian stays
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  // Set while rendering (not in an effect) so that text computed by plain code during this render is already in the new language.
  setCurrentLang(lang);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // not saved, still switched for this visit
    }
  }, []);

  const value = useMemo<Ctx>(
    () => ({ lang, setLang, t: (ka, en, ru) => (lang === "en" ? en : lang === "ru" ? ru : ka) }),
    [lang, setLang],
  );
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export { tt };
export type { Lang, T };

export const useLang = () => useContext(LangContext);
export const useT = () => useContext(LangContext).t;
