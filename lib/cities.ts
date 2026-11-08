import type { SupabaseClient } from "@supabase/supabase-js";
import { tt } from "./lang";

type Names = [string, string, string];

/** The cities a player may play for (the ids are the rows of `cities` in the database). */
export const CITIES: { id: string; names: Names }[] = [
  { id: "tbilisi", names: ["თბილისი", "Tbilisi", "Тбилиси"] },
  { id: "batumi", names: ["ბათუმი", "Batumi", "Батуми"] },
  { id: "kutaisi", names: ["ქუთაისი", "Kutaisi", "Кутаиси"] },
  { id: "rustavi", names: ["რუსთავი", "Rustavi", "Рустави"] },
  { id: "gori", names: ["გორი", "Gori", "Гори"] },
  { id: "zugdidi", names: ["ზუგდიდი", "Zugdidi", "Зугдиди"] },
  { id: "poti", names: ["ფოთი", "Poti", "Поти"] },
  { id: "kobuleti", names: ["ქობულეთი", "Kobuleti", "Кобулети"] },
  { id: "khashuri", names: ["ხაშური", "Khashuri", "Хашури"] },
  { id: "samtredia", names: ["სამტრედია", "Samtredia", "Самтредиа"] },
  { id: "senaki", names: ["სენაკი", "Senaki", "Сенаки"] },
  { id: "zestafoni", names: ["ზესტაფონი", "Zestafoni", "Зестафони"] },
  { id: "marneuli", names: ["მარნეული", "Marneuli", "Марнеули"] },
  { id: "telavi", names: ["თელავი", "Telavi", "Телави"] },
  { id: "akhaltsikhe", names: ["ახალციხე", "Akhaltsikhe", "Ахалцихе"] },
  { id: "ozurgeti", names: ["ოზურგეთი", "Ozurgeti", "Озургети"] },
  { id: "kaspi", names: ["კასპი", "Kaspi", "Каспи"] },
  { id: "borjomi", names: ["ბორჯომი", "Borjomi", "Боржоми"] },
  { id: "mtskheta", names: ["მცხეთა", "Mtskheta", "Мцхета"] },
  { id: "gardabani", names: ["გარდაბანი", "Gardabani", "Гардабани"] },
  { id: "sagarejo", names: ["საგარეჯო", "Sagarejo", "Сагареджо"] },
  { id: "tskaltubo", names: ["წყალტუბო", "Tskaltubo", "Цхалтубо"] },
  { id: "chiatura", names: ["ჭიათურა", "Chiatura", "Чиатура"] },
  { id: "ambrolauri", names: ["ამბროლაური", "Ambrolauri", "Амбролаури"] },
  { id: "lanchkhuti", names: ["ლანჩხუთი", "Lanchkhuti", "Ланчхути"] },
  { id: "abroad", names: ["საზღვარგარეთ", "Abroad", "За границей"] },
];

export const cityName = (id: string | null | undefined): string => {
  const c = CITIES.find((x) => x.id === id);
  return c ? tt(c.names[0], c.names[1], c.names[2]) : id ?? "";
};

export interface CityRow {
  city: string;
  players: number;
  active: number;
  points: number;
  leader: string | null;
  leader_score: number | null;
}

export interface CityPlayer {
  id: string;
  nickname: string;
  avatar_color: string;
  avatar_icon: string;
  avatar_url: string | null;
  equipped_frame: string | null;
  equipped_name: string | null;
  score: number;
}

export async function loadCityBoard(supabase: SupabaseClient): Promise<{ rows: CityRow[]; error: string | null }> {
  const { data, error } = await supabase.rpc("city_board");
  return { rows: (data as CityRow[] | null) ?? [], error: error?.message ?? null };
}

export async function loadCityPlayers(supabase: SupabaseClient, city: string): Promise<CityPlayer[]> {
  const { data } = await supabase.rpc("city_players", { p_city: city, p_limit: 10 });
  return (data as CityPlayer[] | null) ?? [];
}

/** The player's own city and when it may be changed again. */
export async function loadMyCity(supabase: SupabaseClient): Promise<{ city: string | null; canChangeAt: string | null }> {
  const { data } = await supabase.rpc("my_city");
  const d = data as { city: string | null; can_change_at: string | null } | null;
  return { city: d?.city ?? null, canChangeAt: d?.can_change_at ?? null };
}

/** Sets the player's city; returns an error message (Georgian), or null. */
export async function saveCity(supabase: SupabaseClient, city: string): Promise<string | null> {
  const { error } = await supabase.rpc("set_city", { p_city: city });
  if (!error) return null;
  const m = error.message;
  if (m.includes("city locked")) {
    const until = /until (\S+)/.exec(m)?.[1];
    return tt(
      `ქალაქი კვირაში ერთხელ იცვლება${until ? ` (შეცვლა შეგიძლიათ ${new Date(until).toLocaleDateString("ka-GE")}-დან)` : ""}`,
      "The city can be changed once a week",
      "Город можно менять раз в неделю",
    );
  }
  return m;
}
