/**
 * lib/hooks/useAuth.ts
 *
 * Handles the full auth lifecycle:
 *   1. On mount: check stored JWT, init guest if none/expired
 *   2. Token renewal: refresh guest if < 2 days remaining
 *   3. Wallet upgrade: SIWE or Web3Auth → overwrite guest session
 *
 * Also listens for "auth:expired" events dispatched by the API client
 * on 401 responses and re-initialises from guest.
 */

import { useEffect, useCallback, useState } from "react";
import { useAuthStore } from "@/lib/store/authStore";
import {
  loginAsGuest,
  login,
  isTokenFresh,
  type LoginDto,
} from "@/lib/api/auth";
import { getSoulBalance } from "@/lib/api/soul";
import { devConsole } from "@/lib/devConsole";

export function useAuth() {
  const { jwt, playerId, wallet, authMethod, setAuth, clearAuth } =
    useAuthStore();
  const [isInitialising, setIsInitialising] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const initGuest = useCallback(async () => {
    try {
      devConsole.log("AUTH", "initGuest:start", null);
      const res = await loginAsGuest();
      setAuth(res.token, res.playerId, res.wallet, "guest");
      devConsole.log("AUTH", "initGuest:success", {
        playerId: res.playerId,
        wallet: res.wallet,
      });
      return res;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Guest auth failed";
      setError(msg);
      devConsole.log("ERROR", "initGuest:failed", null, { error: msg });
      throw err;
    }
  }, [setAuth]);

  // On mount: validate stored token or create guest
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      setIsInitialising(true);

      if (jwt && isTokenFresh(jwt, 2)) {
        // Token is valid and has plenty of time — use it
        devConsole.log("AUTH", "init:tokenFresh", {
          authMethod,
          playerId,
        });
        setIsInitialising(false);
        return;
      }

      if (jwt && !isTokenFresh(jwt, 0)) {
        // Token is expired
        devConsole.log("AUTH", "init:tokenExpired", { authMethod });
        clearAuth();
      }

      // No valid token — init as guest
      if (!cancelled) {
        try {
          await initGuest();
        } catch {
          // Error already logged in initGuest
        }
      }

      if (!cancelled) setIsInitialising(false);
    };

    init();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount only

  // Listen for 401s from API client
  useEffect(() => {
    const handler = async () => {
      devConsole.log("AUTH", "auth:expired — reinitialising guest", null);
      clearAuth();
      try {
        await initGuest();
      } catch {
        // Logged inside initGuest
      }
    };
    window.addEventListener("auth:expired", handler);
    return () => window.removeEventListener("auth:expired", handler);
  }, [clearAuth, initGuest]);

  /**
   * Upgrade a guest session to a full account via Web3Auth or SIWE.
   * Overwrites stored JWT — playerId migration is post-beta.
   */
  const upgradeAuth = useCallback(
    async (dto: LoginDto) => {
      try {
        devConsole.log("AUTH", `upgradeAuth:${dto.type}`, null);
        const res = await login(dto);
        setAuth(
          res.token,
          res.playerId,
          res.wallet,
          dto.type === "web3auth" ? "web3auth" : "siwe",
        );
        devConsole.log("AUTH", `upgradeAuth:${dto.type}:success`, {
          playerId: res.playerId,
        });
        return res;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Login failed";
        setError(msg);
        throw err;
      }
    },
    [setAuth],
  );

  /**
   * Fetch the player's current SOUL balance from the API.
   */
  const fetchSoulBalance = useCallback(async (): Promise<string> => {
    try {
      const res = await getSoulBalance();
      return res.balance;
    } catch {
      return "0";
    }
  }, []);

  return {
    // State
    jwt,
    playerId,
    wallet,
    authMethod,
    isInitialising,
    isAuthenticated: !!jwt,
    isGuest: authMethod === "guest",
    error,

    // Actions
    upgradeAuth,
    fetchSoulBalance,
    clearAuth,
  };
}
