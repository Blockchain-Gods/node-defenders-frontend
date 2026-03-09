"use client";

/**
 * app/page.tsx
 *
 * Thin shell. Responsibilities:
 *   1. Mount Unity WebGL player
 *   2. Wire useUnityBridge (auth + session + marketplace lifecycle)
 *   3. Block Unity interaction until auth is ready
 *   4. Render DevConsole overlay in dev mode
 *
 * All game UI (menus, marketplace, leaderboard) is Unity-rendered.
 * This page has no screen state machine — Unity owns the UI state.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import UnityGamePlayer from "@/components/UnityGamePlayer";
import DevConsole from "@/components/DevConsole";
import { useUnityBridge } from "@/lib/hooks/useUnityBridge";
import { devConsole } from "@/lib/devConsole";

const BUILD_PATH = "/build";
const DEV = process.env.NEXT_PUBLIC_DEV_MODE === "true";

// ── Auth overlay ──────────────────────────────────────────────────────────────
// Sits above the Unity canvas while auth is initialising.
// pointer-events:all blocks all Unity interaction until it exits.

function AuthOverlay({ isInitialising }: { isInitialising: boolean }) {
  return (
    <AnimatePresence>
      {isInitialising && (
        <motion.div
          key="auth-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.4, ease: "easeOut" } }}
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 40,
            pointerEvents: "all",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(6, 9, 16, 0.85)",
            backdropFilter: "blur(4px)",
          }}
        >
          {/* Spinning ring */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              border: "2px solid rgba(0, 212, 255, 0.12)",
              borderTopColor: "#00d4ff",
            }}
          />

          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            style={{
              marginTop: 14,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              letterSpacing: "0.15em",
              color: "rgba(0, 212, 255, 0.6)",
              textTransform: "uppercase",
            }}
          >
            Initialising
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Corner indicator (dev only) ───────────────────────────────────────────────
// Shows auth state as a small pill in the top-left corner.
// Visible only when NEXT_PUBLIC_DEV_MODE=true.

function CornerIndicator({
  isInitialising,
  isAuthenticated,
  authMethod,
  wallet,
}: {
  isInitialising: boolean;
  isAuthenticated: boolean;
  authMethod: string | null;
  wallet: string | null;
}) {
  if (!DEV) return null;

  const color = isInitialising
    ? "#ffc800"
    : isAuthenticated
      ? "#00ff88"
      : "#ff4444";

  const label = isInitialising
    ? "authenticating..."
    : isAuthenticated
      ? `${authMethod} · ${wallet?.slice(0, 6)}…${wallet?.slice(-4)}`
      : "unauthenticated";

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="fixed top-3 left-3 z-50 flex items-center gap-2 bg-black/60 border border-white/10 rounded px-3 py-1.5 backdrop-blur-sm"
    >
      <motion.span
        animate={isInitialising ? { opacity: [1, 0.3, 1] } : { opacity: 1 }}
        transition={isInitialising ? { duration: 1, repeat: Infinity } : {}}
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: color, boxShadow: `0 0 6px ${color}` }}
      />
      <span className="font-mono text-xs text-slate-400">{label}</span>
    </motion.div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function GamePage() {
  useEffect(() => {
    devConsole.init();
  }, []);

  const { onUnityInstanceReady, startGameSession, auth } = useUnityBridge();

  const [unityReady, setUnityReady] = useState(false);

  const handleUnityReady = useCallback(async () => {
    setUnityReady(true);
    if (!auth.isInitialising && auth.isAuthenticated) {
      await startGameSession();
    }
  }, [auth.isInitialising, auth.isAuthenticated, startGameSession]);

  useEffect(() => {
    if (auth.isInitialising || !auth.isAuthenticated || !unityReady) return;
    startGameSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.isInitialising, auth.isAuthenticated, unityReady]);

  return (
    <div className="h-screen w-screen overflow-hidden bg-black flex items-center justify-center">
      <CornerIndicator
        isInitialising={auth.isInitialising}
        isAuthenticated={auth.isAuthenticated}
        authMethod={auth.authMethod}
        wallet={auth.wallet}
      />

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
              buildPath={BUILD_PATH}
              onUnityInstanceReady={onUnityInstanceReady}
              onUnityReady={handleUnityReady}
              isVisible={true}
            />

            {/* Overlay sits above Unity canvas, fades out once auth resolves */}
            <AuthOverlay isInitialising={auth.isInitialising} />
          </div>
        </div>
      </div>

      <DevConsole />
    </div>
  );
}
