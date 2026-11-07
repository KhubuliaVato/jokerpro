import type { User } from "@supabase/supabase-js";

/** Accounts that see the developer tools (the game server checks the id again before it does anything). */
const DEVELOPERS = ["d99bcbac-de27-45bc-b97c-faf680139cf0"];

export const isDeveloperId = (id: string | null | undefined): boolean => !!id && DEVELOPERS.includes(id);

export const isDeveloper = (user: User | null | undefined): boolean => isDeveloperId(user?.id);
