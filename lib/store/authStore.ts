/**
 * lib/store/authStore.ts
 *
 * Single source of truth for auth state.
 * Persisted to localStorage under key "nd_auth".
 *
 * authMethod:
 *   "guest"    — POST /auth/guest, 30-day JWT, no wallet connected
 *   "web3auth" — Social login via Web3Auth
 *   "siwe"     — Self-custody wallet via SIWE
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { devConsole } from "@/lib/devConsole";

export type AuthMethod = "guest" | "web3auth" | "siwe";

interface AuthState {
  jwt: string | null;
  playerId: string | null;
  wallet: string | null;
  authMethod: AuthMethod | null;
  _hasHydrated: boolean;

  // Actions
  setAuth: (
    jwt: string,
    playerId: string,
    wallet: string,
    method: AuthMethod,
  ) => void;
  clearAuth: () => void;
  isAuthenticated: () => boolean;
  setHasHydrated: (value: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      jwt: null,
      playerId: null,
      wallet: null,
      authMethod: null,
      _hasHydrated: false,

      setAuth: (jwt, playerId, wallet, method) => {
        devConsole.log("AUTH", `setAuth:${method}`, {
          playerId,
          wallet,
          method,
        });
        set({ jwt, playerId, wallet, authMethod: method });
      },

      clearAuth: () => {
        devConsole.log("AUTH", "clearAuth", null);
        set({ jwt: null, playerId: null, wallet: null, authMethod: null });
      },

      isAuthenticated: () => {
        const { jwt } = get();
        return !!jwt;
      },

      setHasHydrated: (value) => set({ _hasHydrated: value }),
    }),
    {
      name: "nd_auth",
      // Only persist these fields — actions are not serialisable
      partialize: (state) => ({
        jwt: state.jwt,
        playerId: state.playerId,
        wallet: state.wallet,
        authMethod: state.authMethod,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
