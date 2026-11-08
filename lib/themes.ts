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
  { id: "dusk", color: "#9a4358", free: false, name: ["ბინდი", "Dusk", "Сумерки"] },
  { id: "bronze", color: "#7a5a1c", free: false, name: ["ბრინჯაო", "Bronze", "Бронза"] },
  { id: "snow", color: "#2b4a70", free: false, fx: true, name: ["თოვლი", "Snow", "Снег"] },
  { id: "stars", color: "#1d1b4b", free: false, fx: true, name: ["ვარსკვლავიანი ღამე", "Starry night", "Звёздная ночь"] },
  { id: "blossom", color: "#b4537c", free: false, fx: true, name: ["საკურას ბაღი", "Sakura garden", "Сад сакуры"] },
  { id: "carbonbg", color: "#2d323b", free: false, fx: true, name: ["კარბონის ბოჭკო", "Carbon fibre", "Карбон"] },
  { id: "glacier", color: "#2f7f9c", free: false, fx: true, name: ["მყინვარის მღვიმე", "Glacier cave", "Ледяная пещера"] },
  { id: "lullaby", color: "#33307a", free: false, fx: true, name: ["მთვარიანი ღამე", "Moonlit night", "Лунная ночь"] },
  { id: "matrixbg", color: "#06401c", free: false, fx: true, name: ["ციფრული წვიმა", "Digital rain", "Цифровой дождь"] },
  { id: "waves", color: "#0e6a83", free: false, fx: true, name: ["ტალღები", "Waves", "Волны"] },
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
