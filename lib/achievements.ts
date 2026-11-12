import type { SupabaseClient } from "@supabase/supabase-js";
import { RANKS } from "./ranks";

type L3 = [string, string, string];

/** The rows of `achievement_defs`: what is counted, how much, and the reward (the database decides who earns what). */
export interface AchievementDef {
  id: string;
  metric: string;
  target: number;
  coins: number;
  xp: number;
  sort: number;
}

export type Group = "games" | "wins" | "online" | "ranks" | "levels" | "collection" | "social";

/** Icon, name and group of every achievement; the hint is made from the metric and the target. */
const META: Record<string, { icon: string; title: L3; group: Group }> = {
  first: { icon: "★", group: "wins", title: ["პირველი გამარჯვება", "First win", "Первая победа"] },
  ten: { icon: "♠", group: "games", title: ["10 თამაში", "10 games", "10 игр"] },
  score: { icon: "♦", group: "wins", title: ["500 ქულა", "500 points", "500 очков"] },
  streak: { icon: "♥", group: "wins", title: ["სამი ზედიზედ", "Three in a row", "Три подряд"] },
  full: { icon: "♛", group: "wins", title: ["სრული თამაშის ოსტატი", "Full game master", "Мастер полной игры"] },
  p50: { icon: "🎴", group: "games", title: ["ორმოცდაათი თამაში", "Fifty games", "Пятьдесят игр"] },
  p100: { icon: "💯", group: "games", title: ["ასი თამაში", "A hundred games", "Сто игр"] },
  p250: { icon: "🔥", group: "games", title: ["ვეტერანი", "Veteran", "Ветеран"] },
  p500: { icon: "🏛", group: "games", title: ["ლეგენდა მაგიდასთან", "Table legend", "Легенда стола"] },
  w5: { icon: "🥉", group: "wins", title: ["ხუთი გამარჯვება", "Five wins", "Пять побед"] },
  w25: { icon: "🥈", group: "wins", title: ["ოცდახუთი გამარჯვება", "Twenty-five wins", "Двадцать пять побед"] },
  w100: { icon: "🥇", group: "wins", title: ["ასი გამარჯვება", "A hundred wins", "Сто побед"] },
  s5: { icon: "⚡", group: "wins", title: ["უჩერებელი", "Unstoppable", "Неудержимый"] },
  pod10: { icon: "🏅", group: "wins", title: ["პრიზიორი", "Podium regular", "Постоянный призёр"] },
  sc1000: { icon: "💎", group: "wins", title: ["ათასი ქულა", "A thousand points", "Тысяча очков"] },
  on1: { icon: "🌐", group: "online", title: ["პირველი ონლაინ თამაში", "First online game", "Первая онлайн-игра"] },
  on10: { icon: "📡", group: "online", title: ["ონლაინ მოთამაშე", "Online player", "Онлайн-игрок"] },
  on50: { icon: "🛰", group: "online", title: ["ონლაინ ვეტერანი", "Online veteran", "Онлайн-ветеран"] },
  rk1: { icon: "⚔", group: "online", title: ["პირველი რეიტინგული", "First ranked game", "Первая рейтинговая"] },
  rk10: { icon: "🛡", group: "online", title: ["რეიტინგული მებრძოლი", "Ranked fighter", "Рейтинговый боец"] },
  bw1: { icon: "♣", group: "wins", title: ["ბურას გამარჯვება", "Bura victory", "Победа в Буре"] },
  bw10: { icon: "🃏", group: "wins", title: ["ბურას ოსტატი", "Bura master", "Мастер Буры"] },
  both: { icon: "🎭", group: "games", title: ["ორივე თამაში", "Both games", "Обе игры"] },
  d7: { icon: "📅", group: "games", title: ["შვიდი დღე", "Seven days", "Семь дней"] },
  d30: { icon: "🗓", group: "games", title: ["ერთგული მოთამაშე", "Loyal player", "Верный игрок"] },
  r_silver: { icon: "🥈", group: "ranks", title: ["ვერცხლის წოდება", "Silver rank", "Серебряный ранг"] },
  r_gold: { icon: "🥇", group: "ranks", title: ["ოქროს წოდება", "Gold rank", "Золотой ранг"] },
  r_diamond: { icon: "💠", group: "ranks", title: ["ბრილიანტის წოდება", "Diamond rank", "Бриллиантовый ранг"] },
  r_master: { icon: "👑", group: "ranks", title: ["მასტერი", "Master", "Мастер"] },
  lv10: { icon: "①", group: "levels", title: ["ლეველი 10", "Level 10", "Уровень 10"] },
  lv25: { icon: "②", group: "levels", title: ["ბრინჯაოს ჩარჩო", "Bronze frame", "Бронзовая рамка"] },
  lv50: { icon: "③", group: "levels", title: ["ვერცხლის ჩარჩო", "Silver frame", "Серебряная рамка"] },
  lv75: { icon: "④", group: "levels", title: ["ოქროს ჩარჩო", "Gold frame", "Золотая рамка"] },
  lv100: { icon: "⑤", group: "levels", title: ["ბრილიანტის ჩარჩო", "Diamond frame", "Бриллиантовая рамка"] },
  i5: { icon: "🛍", group: "collection", title: ["კოლექციონერი", "Collector", "Коллекционер"] },
  i15: { icon: "🎁", group: "collection", title: ["დიდი კოლექცია", "Big collection", "Большая коллекция"] },
  mythic: { icon: "🔮", group: "collection", title: ["მითიკური ნივთი", "Mythic item", "Мифический предмет"] },
  f1: { icon: "🤝", group: "social", title: ["პირველი მეგობარი", "First friend", "Первый друг"] },
  f5: { icon: "👥", group: "social", title: ["კომპანია", "Good company", "Компания"] },
  g1: { icon: "💝", group: "social", title: ["გულუხვი", "Generous", "Щедрый"] },
  city: { icon: "🏙", group: "social", title: ["ქალაქის წარმომადგენელი", "City representative", "Представитель города"] },
  inv1: { icon: "✉", group: "social", title: ["მოწვეული მეგობარი", "Invited a friend", "Приглашённый друг"] },
};

export const GROUPS: { id: Group; label: L3 }[] = [
  { id: "games", label: ["თამაშები", "Games", "Игры"] },
  { id: "wins", label: ["გამარჯვებები", "Wins", "Победы"] },
  { id: "online", label: ["ონლაინ", "Online", "Онлайн"] },
  { id: "ranks", label: ["წოდებები", "Ranks", "Ранги"] },
  { id: "levels", label: ["ლეველები", "Levels", "Уровни"] },
  { id: "collection", label: ["კოლექცია", "Collection", "Коллекция"] },
  { id: "social", label: ["მეგობრები", "Friends", "Друзья"] },
];

export const titleOf = (id: string): L3 | undefined => META[id]?.title;
export const iconOf = (id: string): string => META[id]?.icon ?? "★";
export const groupOf = (id: string): Group => META[id]?.group ?? "games";

/** What has to be done, in words, from what is counted and how much. */
export function hintOf(d: Pick<AchievementDef, "metric" | "target">): L3 {
  const n = d.target;
  switch (d.metric) {
    case "joker_wins":
      return [`მოიგეთ ${n} თამაში ჯოკერში`, `Win ${n} Joker game${n > 1 ? "s" : ""}`, `Выиграйте игр в Джокер: ${n}`];
    case "joker_played":
      return [`დაასრულეთ ${n} თამაში ჯოკერში`, `Finish ${n} Joker games`, `Завершите игр в Джокер: ${n}`];
    case "joker_best":
      return [`ერთ თამაშში ${n}+ ქულა`, `${n}+ points in one game`, `${n}+ очков за одну игру`];
    case "joker_streak":
      return [`მოიგეთ ${n} თამაში ზედიზედ`, `Win ${n} games in a row`, `Выиграйте ${n} игр подряд`];
    case "joker_full_wins":
      return ["მოიგეთ სრული თამაში", "Win a full game", "Выиграйте полную игру"];
    case "played":
      return [`დაასრულეთ ${n} თამაში`, `Finish ${n} games`, `Завершите игр: ${n}`];
    case "wins":
      return [`მოიგეთ ${n} თამაში`, `Win ${n} games`, `Выиграйте игр: ${n}`];
    case "podium":
      return [`მოხვდით პირველ სამეულში ${n}-ჯერ`, `Finish in the top three ${n} times`, `Войдите в тройку ${n} раз`];
    case "online":
      return [`ითამაშეთ ${n} ონლაინ თამაში`, `Play ${n} online game${n > 1 ? "s" : ""}`, `Сыграйте онлайн-игр: ${n}`];
    case "ranked":
      return [`ითამაშეთ ${n} რეიტინგული თამაში`, `Play ${n} ranked game${n > 1 ? "s" : ""}`, `Сыграйте рейтинговых игр: ${n}`];
    case "bura_wins":
      return [`მოიგეთ ${n} თამაში ბურაში`, `Win ${n} Bura game${n > 1 ? "s" : ""}`, `Выиграйте игр в Буру: ${n}`];
    case "game_types":
      return ["ითამაშეთ ჯოკერიც და ბურაც", "Play both Joker and Bura", "Сыграйте и в Джокер, и в Буру"];
    case "days":
      return [`ითამაშეთ ${n} სხვადასხვა დღეს`, `Play on ${n} different days`, `Играйте в ${n} разных дней`];
    case "rating_peak": {
      const rank = RANKS.find((r) => r.min === n)?.name ?? String(n);
      return [`მიაღწიეთ ${rank}-ს`, `Reach ${rank}`, `Достигните ранга ${rank}`];
    }
    case "level":
      return [`მიაღწიეთ ${n} ლეველს`, `Reach level ${n}`, `Достигните ${n} уровня`];
    case "items":
      return [`იყიდეთ ${n} ნივთი`, `Own ${n} items`, `Получите предметов: ${n}`];
    case "mythic":
      return ["იყიდეთ მითიკური ნივთი", "Own a mythic item", "Получите мифический предмет"];
    case "friends":
      return [`დაამატეთ ${n} მეგობარი`, `Make ${n} friend${n > 1 ? "s" : ""}`, `Добавьте друзей: ${n}`];
    case "gifts_sent":
      return ["გააჩუქეთ ნივთი", "Give a gift", "Подарите предмет"];
    case "city":
      return ["აირჩიეთ ქალაქი, რომლისთვისაც თამაშობთ", "Choose the city you play for", "Выберите город, за который играете"];
    case "invited":
      return ["მოიწვიეთ მეგობარი, რომელიც ითამაშებს", "Invite a friend who then plays", "Пригласите друга, который сыграет"];
    default:
      return ["", "", ""];
  }
}

export interface EarnedRow {
  id: string;
  at: string;
}

export interface Board {
  defs: AchievementDef[];
  earned: EarnedRow[];
  /** The figures behind the progress bars; only the player themself gets them. */
  metrics: Record<string, number> | null;
  /** Achievements earned by this very request. */
  fresh: string[];
}

/** The list, with what a player has earned. For one's own page the database also pays what is due and gives the figures. */
export async function loadBoard(supabase: SupabaseClient, userId: string, owner: boolean): Promise<Board | null> {
  const defsRes = await supabase.from("achievement_defs").select("id, metric, target, coins, xp, sort").order("sort");
  if (defsRes.error || !defsRes.data) return null;
  const defs = defsRes.data as AchievementDef[];
  if (owner) {
    const { data, error } = await supabase.rpc("my_achievements");
    if (!error && data) {
      const d = data as { metrics: Record<string, number>; earned: EarnedRow[]; fresh: string[] };
      return { defs, earned: d.earned, metrics: d.metrics, fresh: d.fresh };
    }
  }
  const { data } = await supabase.from("player_achievements").select("id, earned_at").eq("user_id", userId);
  return { defs, earned: ((data ?? []) as { id: string; earned_at: string }[]).map((e) => ({ id: e.id, at: e.earned_at })), metrics: null, fresh: [] };
}
