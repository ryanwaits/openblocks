import { create } from "zustand";
import { signInAnonymously, getSession, signOut as supabaseSignOut } from "@/lib/supabase/auth";

interface AuthState {
  userId: string | null;
  displayName: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
  restoreSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  userId: null,
  displayName: null,
  isAuthenticated: false,
  isLoading: true,

  signIn: async (displayName: string) => {
    const { session } = await signInAnonymously(displayName);
    if (session) {
      set({
        userId: session.user.id,
        displayName,
        isAuthenticated: true,
      });
    }
  },

  signOut: async () => {
    await supabaseSignOut();
    set({ userId: null, displayName: null, isAuthenticated: false });
  },

  restoreSession: async () => {
    try {
      const session = await getSession();
      if (session) {
        set({
          userId: session.user.id,
          displayName: session.user.user_metadata?.display_name || "Anonymous",
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },
}));
