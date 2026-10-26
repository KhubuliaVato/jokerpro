/** Georgian text for the errors Supabase Auth and Postgres can return in our flows. */
export function authMessage(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "ელფოსტა ან პაროლი არასწორია";
  if (m.includes("already registered") || m.includes("already been registered"))
    return "ეს ელფოსტა უკვე რეგისტრირებულია";
  if (m.includes("password") && (m.includes("at least") || m.includes("short") || m.includes("weak")))
    return "პაროლი მინიმუმ 6 სიმბოლოსგან უნდა შედგებოდეს";
  if (m.includes("email not confirmed")) return "ელფოსტა ჯერ არ არის დადასტურებული. შეამოწმეთ შემოსული წერილები";
  if (m.includes("valid email") || m.includes("invalid email") || (m.includes("email address") && m.includes("invalid"))) return "ელფოსტის მისამართი არასწორია";
  if (m.includes("rate limit") || m.includes("too many")) return "ძალიან ბევრი მცდელობა, სცადეთ ცოტა ხანში";
  if (m.includes("duplicate") || m.includes("profiles_nickname_key") || m.includes("saving new user"))
    return "ეს სახელი უკვე დაკავებულია";
  if (m.includes("failed to fetch") || m.includes("network")) return "კავშირის შეცდომა, შეამოწმეთ ინტერნეტი";
  return `შეცდომა: ${message}`;
}

export const NICKNAME_MIN = 2;
export const NICKNAME_MAX = 16;

/** Returns an error message for a nickname, or null if it is acceptable. */
export function validateNickname(raw: string): string | null {
  const n = raw.trim();
  if (n.length < NICKNAME_MIN) return `სახელი მინიმუმ ${NICKNAME_MIN} სიმბოლო უნდა იყოს`;
  if (n.length > NICKNAME_MAX) return `სახელი მაქსიმუმ ${NICKNAME_MAX} სიმბოლო უნდა იყოს`;
  return null;
}
