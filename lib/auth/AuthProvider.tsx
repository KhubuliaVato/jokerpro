"use client";

import { tt } from "@/lib/lang";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { authMessage, validateNickname } from "./messages";

export interface Profile {
  id: string;
  nickname: string;
  avatar_color: string;
  avatar_icon: string;
  /** Uploaded photo; when set it is shown instead of the colour + icon. */
  avatar_url: string | null;
  created_at: string;
}

type ProfilePatch = Partial<Pick<Profile, "nickname" | "avatar_color" | "avatar_icon">> & {
  /** A new photo (already resized), `null` to remove the current one, undefined to leave it. */
  photo?: Blob | null;
};

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
  signOut: () => Promise<void>;
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
      setUser(data.session?.user ?? null);
      setLoading(false);
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
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !userId) return;
    let cancelled = false;
    supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setProfileRow((data as Profile | null) ?? null);
      });
    return () => {
      cancelled = true;
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

  const signOut = useCallback(async () => {
    await getSupabase()?.auth.signOut();
  }, []);

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
      signOut,
      updateProfile,
      nicknameAvailable,
    }),
    [loading, user, profile, signIn, signUp, signOut, updateProfile, nicknameAvailable],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
