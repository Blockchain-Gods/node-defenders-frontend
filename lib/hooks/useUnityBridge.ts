/**
 * lib/hooks/useUnityBridge.ts
 *
 * Central wiring layer. Attaches the bridge receiver on mount,
 * subscribes to all inbound Unity events, calls the appropriate
 * hooks, and sends results back to Unity via bridge sender.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  attachBridgeReceiver,
  detachBridgeReceiver,
  onBridgeEvent,
} from "@/lib/bridge/receiver";
import {
  sendAuthReady,
  sendSessionStarted,
  sendMarketplaceData,
  sendPurchaseResult,
  sendRawMessage,
} from "@/lib/bridge/sender";
import {
  getMyProfile,
  getOwnedTypeIds,
  getRentedTypeIds,
} from "@/lib/api/player";
import { useAuth } from "./useAuth";
import { useGameSession } from "./useGameSession";
import { useMarketplace } from "./useMarketplace";
import { devConsole } from "@/lib/devConsole";

export function useUnityBridge() {
  const unityInstanceRef = useRef<any>(null);
  const [unityReady, setUnityReady] = useState(false);

  const auth = useAuth();
  const session = useGameSession();
  const marketplace = useMarketplace();

  // Attach receiver once on mount
  useEffect(() => {
    attachBridgeReceiver();
    return () => detachBridgeReceiver();
  }, []);

  /**
   * Fetch balance + profile and send OnAuthReady to Unity.
   * Used both on initial load and after session end / purchase.
   */
  const dispatchAuthReady = useCallback(
    async (instance: any) => {
      if (!auth.wallet || !auth.playerId) return;

      try {
        const [soulBalance, profile] = await Promise.all([
          auth.fetchSoulBalance(),
          getMyProfile(),
        ]);

        sendAuthReady(instance, {
          wallet: auth.wallet,
          soulBalance,
          playerId: auth.playerId,
          ownedTypeIds: getOwnedTypeIds(profile),
          rentedTypeIds: getRentedTypeIds(profile),
        });
      } catch (err) {
        devConsole.log("ERROR", "dispatchAuthReady:failed", null, {
          error: err instanceof Error ? err.message : "Unknown",
        });
      }
    },
    [auth],
  );

  /**
   * Called by UnityGamePlayer when the Unity instance is ready.
   * Sends auth state immediately so Unity can unblock its loading screen.
   */
  const onUnityInstanceReady = useCallback(
    async (instance: any) => {
      unityInstanceRef.current = instance;
      setUnityReady(true);
      devConsole.log("INFO", "unity:instanceReady", null);
      if (!auth.isInitialising && auth.isAuthenticated) {
        await dispatchAuthReady(instance);
      }
    },
    [auth.isInitialising, auth.isAuthenticated, dispatchAuthReady],
  );

  /**
   * Once auth initialises (guest or upgraded), send OnAuthReady to Unity.
   * Handles the case where Unity loads before auth completes.
   */
  useEffect(() => {
    if (auth.isInitialising || !auth.isAuthenticated || !unityReady) return;
    const instance = unityInstanceRef.current;
    if (!instance) return;
    dispatchAuthReady(instance);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.isInitialising, auth.isAuthenticated, unityReady]);

  // ── Inbound: gameplay_submission (analytics payload only) ────────────────
  useEffect(() => {
    return onBridgeEvent("gameplay_submission", async (data) => {
      console.log("BRIDGE_IN", "gameplay_submission", data);
      // Analytics only — session lifecycle handled by beta_session_end
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Inbound: beta_session_end ─────────────────────────────────────────────
  // TODO: merge with gameplay_submission once GameAnalyticsManager is refactored
  useEffect(() => {
    return onBridgeEvent("beta_session_end", async (data) => {
      const soulEarned = (data as any)?.soul_earned;

      console.log(`SoulWei: ${soulEarned}, sessionID: ${session.sessionId}`);

      if (soulEarned && session.sessionId) {
        // Convert raw soul units to wei (multiply by 1e18 using BigInt to avoid overflow)

        session.recordEarn(soulEarned);
        await new Promise((r) => setTimeout(r, 300));
      }

      await session.finishSession();
      await dispatchAuthReady(unityInstanceRef.current);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    session.finishSession,
    session.recordEarn,
    session.sessionId,
    dispatchAuthReady,
  ]);

  // ── Inbound: request_game_data ───────────────────────────────────────────
  useEffect(() => {
    const handler = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const msg = event.data as {
        type?: string;
        gameObjectName?: string;
        methodName?: string;
      };
      if (msg?.type !== "request_game_data") return;

      try {
        const res = await fetch("/survival_config.json");
        const json = await res.text();
        sendRawMessage(
          unityInstanceRef.current,
          msg.gameObjectName ?? "DataParser",
          msg.methodName ?? "ReceiveGameDataFromJS",
          json,
        );
      } catch (err) {
        devConsole.log("ERROR", "request_game_data:failed", null, {
          error: err instanceof Error ? err.message : "Unknown",
        });
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  // ── Inbound: marketplace_open ─────────────────────────────────────────────
  useEffect(() => {
    return onBridgeEvent("marketplace_open", async (_data) => {
      const listings = await marketplace.fetchListings();
      sendMarketplaceData(unityInstanceRef.current, { listings });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketplace.fetchListings]);

  // ── Inbound: marketplace_buy ──────────────────────────────────────────────
  useEffect(() => {
    return onBridgeEvent(
      "marketplace_buy",
      async ({ typeId, paymentToken }) => {
        const result = await marketplace.purchase(typeId, paymentToken);
        sendPurchaseResult(unityInstanceRef.current, result);
        if (result.success) {
          await dispatchAuthReady(unityInstanceRef.current);
        }
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketplace.purchase, dispatchAuthReady]);

  // ── Inbound: marketplace_rent ─────────────────────────────────────────────
  useEffect(() => {
    return onBridgeEvent(
      "marketplace_rent",
      async ({ typeId, tierId, paymentToken }) => {
        console.log(
          `[onBridgeEvent] typeId: ${typeId}, tierId: ${tierId}, paymentToken: ${paymentToken}`,
        );

        const result = await marketplace.rent(typeId, tierId, paymentToken);
        sendPurchaseResult(unityInstanceRef.current, result);
        if (result.success) {
          await dispatchAuthReady(unityInstanceRef.current);
        }
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketplace.rent, dispatchAuthReady]);

  const startGameSession = useCallback(async () => {
    const res = await session.beginSession();
    console.log("[startGameSession] res: ", res);
    if (res) {
      sendSessionStarted(unityInstanceRef.current, { sessionId: res.id });
    }
    return res;
  }, [session]);

  return {
    onUnityInstanceReady,
    startGameSession,
    session,
    auth,
    marketplace,
  };
}
