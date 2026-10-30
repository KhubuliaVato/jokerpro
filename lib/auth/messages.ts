import { tt } from "../lang";

/** Georgian (or English / Russian) text for the errors Supabase Auth and Postgres can return in our flows. */
export function authMessage(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return tt("ელფოსტა ან პაროლი არასწორია", "Wrong email or password", "Неверная почта или пароль");
  if (m.includes("already registered") || m.includes("already been registered"))
    return tt("ეს ელფოსტა უკვე რეგისტრირებულია", "This email is already registered", "Эта почта уже зарегистрирована");
  if (m.includes("password") && (m.includes("at least") || m.includes("short") || m.includes("weak")))
    return tt("პაროლი მინიმუმ 6 სიმბოლოსგან უნდა შედგებოდეს", "The password must be at least 6 characters", "Пароль должен быть не короче 6 символов");
  if (m.includes("email not confirmed")) return tt("ელფოსტა ჯერ არ არის დადასტურებული. შეამოწმეთ შემოსული წერილები", "The email is not confirmed yet. Check your inbox", "Почта ещё не подтверждена. Проверьте входящие");
  if (m.includes("valid email") || m.includes("invalid email") || (m.includes("email address") && m.includes("invalid"))) return tt("ელფოსტის მისამართი არასწორია", "The email address is not valid", "Адрес почты указан неверно");
  if (m.includes("rate limit") || m.includes("too many")) return tt("ძალიან ბევრი მცდელობა, სცადეთ ცოტა ხანში", "Too many attempts, try again in a little while", "Слишком много попыток, попробуйте позже");
  if (m.includes("duplicate") || m.includes("profiles_nickname_key") || m.includes("saving new user"))
    return tt("ეს სახელი უკვე დაკავებულია", "This name is already taken", "Это имя уже занято");
  if (m.includes("failed to fetch") || m.includes("network")) return tt("კავშირის შეცდომა, შეამოწმეთ ინტერნეტი", "Connection error, check your internet", "Ошибка соединения, проверьте интернет");
  return `${tt("შეცდომა", "Error", "Ошибка")}: ${message}`;
}

export const NICKNAME_MIN = 2;
export const NICKNAME_MAX = 16;

/** Returns an error message for a nickname, or null if it is acceptable. */
export function validateNickname(raw: string): string | null {
  const n = raw.trim();
  if (n.length < NICKNAME_MIN) return tt(`სახელი მინიმუმ ${NICKNAME_MIN} სიმბოლო უნდა იყოს`, `The name must be at least ${NICKNAME_MIN} characters`, `Имя должно быть не короче ${NICKNAME_MIN} символов`);
  if (n.length > NICKNAME_MAX) return tt(`სახელი მაქსიმუმ ${NICKNAME_MAX} სიმბოლო უნდა იყოს`, `The name must be at most ${NICKNAME_MAX} characters`, `Имя должно быть не длиннее ${NICKNAME_MAX} символов`);
  return null;
}
