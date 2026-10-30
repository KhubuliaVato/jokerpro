// The language switch for code that is not a React component (name tables, error texts). It has no React in it, so
// the Edge Functions can bundle the shared game code that uses it.

export type Lang = "ka" | "en" | "ru";

/** Picks the text for the current language: `t("ქართული", "English", "Русский")`. */
export type T = (ka: string, en: string, ru: string) => string;

let current: Lang = "ka";

export const setCurrentLang = (lang: Lang) => {
  current = lang;
};

/** The same pick for plain code; it follows the language last chosen (the server always answers in Georgian). */
export const tt: T = (ka, en, ru) => (current === "en" ? en : current === "ru" ? ru : ka);

/** A list whose items read in the current language each time they are used: `[ka, en, ru]` per item. */
export function localizedList(items: readonly (readonly [string, string, string])[]): string[] {
  const out = items.map(() => "");
  items.forEach((item, i) => Object.defineProperty(out, i, { get: () => tt(item[0], item[1], item[2]), enumerable: true }));
  return out;
}
