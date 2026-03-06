/**
 * lib/hooks/useGameSession.ts
 *
 * Manages the game session lifecycle against the new NestJS API.
 *
 * Flow:
 *   beginSession()   → POST /sessions/start → store sessionId
 *   recordEarn(amt)  → POST /sessions/earn  (fire-and-forget)
 *   finishSession()  → POST /sessions/end   → returns totalSoulEarned
 *
 * beforeunload: calls finishSession best-effort if a session is active.
 * On new session start: any existing active session is abandoned server-side
 * (the API handles this automatically).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  startSession,
  earnSoul,
  endSession,
  type SessionStartResponse,
  type SessionEndResponse,
} from "@/lib/api/session";
import { devConsole } from "@/lib/devConsole";

export type SessionStatus = "idle" | "active" | "ending" | "ended" | "error";

export function useGameSession() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [status, setStatus] = useState<SessionStatus>("idle");
  const [lastResult, setLastResult] = useState<SessionEndResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Stable ref so beforeunload handler always sees current sessionId
  const sessionIdRef = useRef<string | null>(null);
  sessionIdRef.current = sessionId;

  const beginSession =
    useCallback(async (): Promise<SessionStartResponse | null> => {
      try {
        setError(null);
        setStatus("active");
        devConsole.log("INFO", "session:start", null);

        const res = await startSession();
        setSessionId(res.id);
        sessionIdRef.current = res.id;
        devConsole.log("INFO", "session:started", { sessionId: res.id });
        return res;
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Failed to start session";
        setError(msg);
        setStatus("error");
        devConsole.log("ERROR", "session:start:failed", null, { error: msg });
        return null;
      }
    }, []);

  /**
   * Fire-and-forget during gameplay. Do NOT await in hot path.
   */
  const recordEarn = useCallback((amount: string) => {
    const id = sessionIdRef.current;
    if (!id) return;
    earnSoul(id, amount).catch((err) => {
      devConsole.log(
        "ERROR",
        "session:earn:failed",
        { amount },
        {
          error: err instanceof Error ? err.message : "Unknown",
        },
      );
    });
  }, []);

  const finishSession =
    useCallback(async (): Promise<SessionEndResponse | null> => {
      const id = sessionIdRef.current;
      if (!id || status === "ending" || status === "ended") return null;

      try {
        setStatus("ending");
        devConsole.log("INFO", "session:end", { sessionId: id });

        const res = await endSession(id);
        setLastResult(res);
        setStatus("ended");
        setSessionId(null);
        sessionIdRef.current = null;
        devConsole.log("INFO", "session:ended", res);
        return res;
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Failed to end session";
        setError(msg);
        setStatus("error");
        devConsole.log("ERROR", "session:end:failed", null, { error: msg });
        return null;
      }
    }, [status]);

  const resetSession = useCallback(() => {
    setSessionId(null);
    sessionIdRef.current = null;
    setStatus("idle");
    setLastResult(null);
    setError(null);
  }, []);

  // Best-effort session cleanup on tab close
  useEffect(() => {
    const handleUnload = () => {
      const id = sessionIdRef.current;
      if (!id) return;
      // sendBeacon for reliability on page unload
      const apiBase =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
      const jwt = (() => {
        try {
          const raw = localStorage.getItem("nd_auth");
          return raw ? JSON.parse(raw)?.state?.jwt : null;
        } catch {
          return null;
        }
      })();

      navigator.sendBeacon(
        `${apiBase}/sessions/end`,
        new Blob([JSON.stringify({ sessionId: id })], {
          type: "application/json",
        }),
      );
      // sendBeacon can't set headers, so JWT auth on the beacon will fail
      // unless the API adds a fallback. For beta this is acceptable —
      // the API auto-abandons orphaned sessions on next session start.
    };

    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, []);

  return {
    sessionId,
    status,
    lastResult,
    error,
    isActive: status === "active",

    beginSession,
    recordEarn,
    finishSession,
    resetSession,
  };
}
