"use client";

import { setSoundPack } from "@/lib/sound";
import { tt } from "@/lib/lang";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { readCache, writeCache } from "@/lib/cache";
import { warmGameServers } from "@/lib/online/client";
import { authMessage, validateNickname } from "./messages";

/** Fired after something the profile shows was changed outside the profile form (what is worn, a bought nickname). */
export const PROFILE_CHANGED = "profile:changed";

export interface Profile {
  id: string;
  nickname: string;
  avatar_color: string;
  avatar_icon: string;
  /** Uploaded photo; when set it is shown instead of the colour + icon. */
  avatar_url: string | null;
  /** The card back worn at the table (a shop item), or null for the standard one. */
  equipped_back?: string | null;
  equipped_frame?: string | null;
  equipped_name?: string | null;
  equipped_fx?: string | null;
  equipped_play?: string | null;
  equipped_sound?: string | null;
  created_at: string;
}

type ProfilePatch = Partial<Pick<Profile, "nickname" | "avatar_color" | "avatar_icon">> & {
  /** A new photo (already resized), `null` to remove the current one, undefined to leave it. */
  photo?: Blob | null;
};

export type OAuthProvider = "google";

interface AuthValue {
  /** False while NEXT_PUBLIC_SUPABASE_* are missing. */
  configured: boolean;
  /** True until the stored session (if any) has been read. */
  loading: boolean;
  user: User | null;
  profile: Profile | null;
  signIn: (email: string, password: string) => Promise<string | null>;
  /** `needsConfirm` is true when the project requires e-mail confirmation before the first sign-in. */
  signUp: (
    email: string,
    password: string,
    nickname: string,
  ) => Promise<{ error: string | null; needsConfirm: boolean }>;
  /** Leaves for the provider's sign-in page; comes back to /login (and from there to `?next=`). Resolves only on a failure to leave. */
  signInWithProvider: (provider: OAuthProvider) => Promise<string | null>;
  signOut: () => Promise<void>;
  /** Deletes the signed-in player's account for good; returns an error message, or null when it is gone. */
  deleteAccount: () => Promise<string | null>;
  updateProfile: (patch: ProfilePatch) => Promise<string | null>;
  /** Whether a nickname is free (the player's own current one counts as free). */
  nicknameAvailable: (nickname: string) => Promise<boolean | null>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profileRow, setProfileRow] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  // Follow the session.
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      const found = data.session?.user ?? null;
      // draw the header from the last profile this browser saw while the fresh one loads
      if (found) setProfileRow((now) => now ?? readCache<Profile>("profile", found.id));
      setUser(found);
      setLoading(false);
      if (data.session) warmGameServers();
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  // Load the profile of whoever is signed in.
  const userId = user?.id ?? null;
  // A stored profile only counts while it belongs to the signed-in user.
  const profile = userId && profileRow?.id === userId ? profileRow : null;
  const soundPack = profile?.equipped_sound ?? null;
  useEffect(() => {
    setSoundPack(soundPack);
  }, [soundPack]);
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !userId) return;
    let cancelled = false;
    const load = () =>
      supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle()
        .then(({ data }) => {
          if (cancelled) return;
          setProfileRow((data as Profile | null) ?? null);
          if (data) writeCache("profile", userId, data as Profile);
        });
    void load();
    // the shop changes what the player wears (and the nickname): read the profile again
    window.addEventListener(PROFILE_CHANGED, load);
    return () => {
      cancelled = true;
      window.removeEventListener(PROFILE_CHANGED, load);
    };
  }, [userId]);

  const signIn = useCallback(async (email: string, password: string) => {
    const supabase = getSupabase();
    if (!supabase) return tt("მონაცემთა ბაზა ჯერ არ არის მიერთებული", "The database is not connected yet", "База данных ещё не подключена");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    return error ? authMessage(error.message) : null;
  }, []);

  const signUp = useCallback(async (email: string, password: string, nickname: string) => {
    const supabase = getSupabase();
    if (!supabase) return { error: tt("მონაცემთა ბაზა ჯერ არ არის მიერთებული", "The database is not connected yet", "База данных ещё не подключена"), needsConfirm: false };
    const nameError = validateNickname(nickname);
    if (nameError) return { error: nameError, needsConfirm: false };
    const name = nickname.trim();

    // Fail early, in plain words, if the nickname is already taken.
    const { data: free } = await supabase.rpc("nickname_available", { n: name });
    if (free === false) return { error: tt("ეს სახელი უკვე დაკავებულია", "This name is already taken", "Это имя уже занято"), needsConfirm: false };

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { nickname: name } },
    });
    if (error) return { error: authMessage(error.message), needsConfirm: false };
    return { error: null, needsConfirm: !data.session };
  }, []);

  const signInWithProvider = useCallback(async (provider: OAuthProvider) => {
    const supabase = getSupabase();
    if (!supabase) return tt("მონაცემთა ბაზა ჯერ არ არის მიერთებული", "The database is not connected yet", "База данных ещё не подключена");
    const next = new URLSearchParams(window.location.search).get("next");
    const back = `${window.location.origin}/login${next && next.startsWith("/") && !next.startsWith("//") ? `?next=${encodeURIComponent(next)}` : ""}`;
    const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: back } });
    return error ? tt("ამ გზით შესვლა ჯერ ვერ მოხერხდა", "Signing in this way is not available yet", "Вход этим способом пока недоступен") : null;
  }, []);

  const signOut = useCallback(async () => {
    await getSupabase()?.auth.signOut();
    writeCache("profile", "", null);
    writeCache("coins", "", null);
  }, []);

  const deleteAccount = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase || !userId) return tt("ჯერ შედით ანგარიშში", "Sign in first", "Сначала войдите");
    // the photo file is not removed with the account by the database: take it away first (nothing to do when there is none)
    await supabase.storage.from("avatars").remove([`${userId}/avatar.webp`]);
    const { error } = await supabase.rpc("delete_my_account");
    if (error) {
      if (error.message.includes("leave your table")) return tt("ჯერ დატოვეთ მაგიდა, სადაც ზიხართ", "Leave your table first", "Сначала покиньте стол, за которым сидите");
      if (error.message.includes("second step")) return tt("უსაფრთხოებისთვის ჯერ გამოდით და შედით თავიდან, მეორე დადასტურებით", "For safety, sign out and sign in again with the second step first", "Для безопасности выйдите и войдите снова со вторым подтверждением");
      return authMessage(error.message);
    }
    await signOut();
    return null;
  }, [userId, signOut]);

  const nicknameAvailable = useCallback(async (nickname: string) => {
    const supabase = getSupabase();
    if (!supabase) return null;
    const { data, error } = await supabase.rpc("nickname_available", { n: nickname.trim() });
    return error ? null : (data as boolean);
  }, []);

  const updateProfile = useCallback(
    async ({ photo, ...patch }: ProfilePatch) => {
      const supabase = getSupabase();
      if (!supabase || !userId) return tt("ჯერ შედით ანგარიშში", "Sign in first", "Сначала войдите");
      const changes: Partial<Profile> = { ...patch };
      if (patch.nickname !== undefined) {
        const nameError = validateNickname(patch.nickname);
        if (nameError) return nameError;
        changes.nickname = patch.nickname.trim();
      }

      // One photo per player at a fixed path; the version in the URL makes browsers fetch the new one.
      const path = `${userId}/avatar.webp`;
      if (photo) {
        const { error } = await supabase.storage
          .from("avatars")
          .upload(path, photo, { upsert: true, contentType: photo.type || "image/webp" });
        if (error) return `${tt("სურათი ვერ აიტვირთა", "Could not upload the picture", "Не удалось загрузить картинку")}: ${error.message}`;
        const { data } = supabase.storage.from("avatars").getPublicUrl(path);
        changes.avatar_url = `${data.publicUrl}?v=${Date.now()}`;
      } else if (photo === null) {
        await supabase.storage.from("avatars").remove([path]);
        changes.avatar_url = null;
      }

      const { data, error } = await supabase.from("profiles").update(changes).eq("id", userId).select("*").single();
      if (error) return authMessage(error.message);
      setProfileRow(data as Profile);
      return null;
    },
    [userId],
  );

  const value = useMemo<AuthValue>(
    () => ({
      configured: isSupabaseConfigured,
      loading,
      user,
      profile,
      signIn,
      signUp,
      signInWithProvider,
      signOut,
      deleteAccount,
      updateProfile,
      nicknameAvailable,
    }),
    [loading, user, profile, signIn, signUp, signInWithProvider, signOut, deleteAccount, updateProfile, nicknameAvailable],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
