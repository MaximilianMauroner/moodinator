import { create } from "zustand";
import { ONBOARDING_COMPLETED_KEY } from "@/shared/storage/keys";
import { getBoolean, setBoolean } from "@/shared/storage/asyncStorage";

export type OnboardingStore = {
  hydrated: boolean;
  hasCompletedOnboarding: boolean;

  hydrate: () => Promise<void>;
  complete: () => Promise<void>;
  reset: () => Promise<void>;
};

export const useOnboardingStore = create<OnboardingStore>((set) => ({
  hydrated: false,
  hasCompletedOnboarding: false,

  hydrate: async () => {
    const completed = await getBoolean(ONBOARDING_COMPLETED_KEY);
    set({
      hydrated: true,
      hasCompletedOnboarding: completed ?? false,
    });
  },

  complete: async () => {
    await setBoolean(ONBOARDING_COMPLETED_KEY, true);
    set({ hasCompletedOnboarding: true });
  },

  reset: async () => {
    await setBoolean(ONBOARDING_COMPLETED_KEY, false);
    set({ hasCompletedOnboarding: false });
  },
}));
