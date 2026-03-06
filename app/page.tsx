"use client";

/**
 * app/page.tsx
 *
 * Thin shell. Responsibilities:
 *   1. Mount Unity WebGL player
 *   2. Wire useUnityBridge (auth + session + marketplace lifecycle)
 *   3. Render DevConsole overlay in dev mode
 *
 * All game UI (menus, marketplace, leaderboard) is Unity-rendered.
 * This page has no screen state machine — Unity owns the UI state.
 */

import { useCallback } from "react";
import UnityGamePlayer from "@/components/UnityGamePlayer";
import DevConsole from "@/components/DevConsole";
import { useUnityBridge } from "@/lib/hooks/useUnityBridge";

export default function GamePage() {
  const { onUnityInstanceReady, startGameSession, auth } = useUnityBridge();

  /**
   * Called by UnityGamePlayer after Unity settles.
   * Starts a game session immediately — Unity's Play button triggers
   * gameplay start, but we open the session here so sessionId is
   * ready before the first earn call.
   */
  const handleUnityReady = useCallback(async () => {
    if (!auth.isInitialising) {
      await startGameSession();
    }
  }, [auth.isInitialising, startGameSession]);

  return (
    <div className="h-screen w-screen overflow-hidden bg-black flex items-center justify-center">
      {/* Auth status indicator — visible only in dev mode */}
      {process.env.NEXT_PUBLIC_DEV_MODE === "true" && (
        <div className="fixed top-3 left-3 z-50 flex items-center gap-2 bg-black/60 border border-white/10 rounded px-3 py-1.5 backdrop-blur-sm">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: auth.isInitialising
                ? "#ffc800"
                : auth.isAuthenticated
                  ? "#00ff88"
                  : "#ff4444",
              boxShadow: `0 0 6px ${
                auth.isInitialising
                  ? "#ffc800"
                  : auth.isAuthenticated
                    ? "#00ff88"
                    : "#ff4444"
              }`,
            }}
          />
          <span className="font-mono text-xs text-slate-400">
            {auth.isInitialising
              ? "authenticating..."
              : auth.isAuthenticated
                ? `${auth.authMethod} · ${auth.wallet?.slice(0, 6)}…${auth.wallet?.slice(-4)}`
                : "unauthenticated"}
          </span>
        </div>
      )}

      {/* Unity game — centred, 9:16 aspect ratio, max height */}
      <div className="relative w-full max-w-xl h-full">
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            padding:
              "env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)",
          }}
        >
          <div
            className="relative w-full"
            style={{ aspectRatio: "9 / 16", maxHeight: "100vh" }}
          >
            <UnityGamePlayer
              buildPath="/unity-build"
              onUnityInstanceReady={onUnityInstanceReady}
              onUnityReady={handleUnityReady}
              isVisible={true}
            />
          </div>
        </div>
      </div>

      {/* Dev console — no-op in production */}
      <DevConsole />
    </div>
  );
}
