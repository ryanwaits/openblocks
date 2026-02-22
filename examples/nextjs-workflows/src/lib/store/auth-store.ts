import { create } from "zustand";

const ADJECTIVES = ["Swift", "Bold", "Calm", "Keen", "Warm", "Bright", "Quick", "Steady"];
const NOUNS = ["Falcon", "Panda", "Fox", "Otter", "Hawk", "Tiger", "Bear", "Wolf"];

function generateName(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${adj} ${noun}`;
}

interface AuthState {
  userId: string;
  displayName: string;
  restore: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  userId: "",
  displayName: "",

  restore: () => {
    try {
      let userId = localStorage.getItem("wf-userId");
      let displayName = localStorage.getItem("wf-displayName");
      if (!userId) {
        userId = crypto.randomUUID();
        displayName = generateName();
        localStorage.setItem("wf-userId", userId);
        localStorage.setItem("wf-displayName", displayName);
      }
      set({ userId, displayName: displayName || generateName() });
    } catch {
      const userId = crypto.randomUUID();
      set({ userId, displayName: generateName() });
    }
  },
}));
