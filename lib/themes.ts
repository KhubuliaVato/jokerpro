/** Background colours of the site; the values live in globals.css under [data-theme]. Wine and green are free, the rest are shop items. */
export const THEMES = [
  { id: "wine", color: "#8a2540", free: true, name: ["ღვინისფერი", "Wine", "Бордовый"] },
  { id: "green", color: "#1f7a4d", free: true, name: ["მწვანე", "Green", "Зелёный"] },
  { id: "blue", color: "#25588f", free: false, name: ["ლურჯი", "Blue", "Синий"] },
  { id: "purple", color: "#5a3392", free: false, name: ["იისფერი", "Purple", "Фиолетовый"] },
  { id: "graphite", color: "#454b55", free: false, name: ["გრაფიტი", "Graphite", "Графит"] },
  { id: "northern", color: "#0d4457", free: false, fx: true, name: ["ჩრდილოეთის ციალი", "Northern lights", "Северное сияние"] },
  { id: "suits", color: "#0f4a37", free: false, fx: true, name: ["კარტის ნიშნები", "Card suits", "Масти"] },
  { id: "embers", color: "#5a1a10", free: false, fx: true, name: ["ნაკვერჩხალი", "Embers", "Угли"] },
] as const;

export const DEFAULT_THEME = "wine";
const KEY = "theme";
export const THEME_CHANGED = "theme:changed";

export const themeById = (id: string | null | undefined) => THEMES.find((t) => t.id === id);

/** The theme remembered in this browser (the page script has already painted it). */
export function savedTheme(): string {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved && themeById(saved)) return saved;
  } catch {
    // private mode: the colour just is not remembered
  }
  return DEFAULT_THEME;
}

/** Paints a theme, remembers it, and tells whoever shows the current one. */
export function applyTheme(id: string) {
  document.documentElement.dataset.theme = id;
  try {
    localStorage.setItem(KEY, id);
  } catch {
    // not remembered
  }
  window.dispatchEvent(new Event(THEME_CHANGED));
}
