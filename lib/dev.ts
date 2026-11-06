import type { User } from "@supabase/supabase-js";

/** Accounts that see the developer tools (nothing here can touch the database or other players). */
const DEVELOPERS = ["d99bcbac-de27-45bc-b97c-faf680139cf0"];

export const isDeveloper = (user: User | null | undefined): boolean => !!user && DEVELOPERS.includes(user.id);
