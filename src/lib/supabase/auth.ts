import { createClient } from "./client";

export async function signInAnonymously(displayName: string) {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signInAnonymously({
    options: { data: { display_name: displayName } },
  });
  if (error) throw error;
  return data;
}

export async function getSession() {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
}
