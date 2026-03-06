/**
 * lib/hooks/useUnityBridge.ts
 *
 * The central wiring layer. Attaches the bridge receiver on mount,
 * subscribes to all inbound Unity events, and calls the appropriate
 * hooks. Sends results back to Unity via bridge sender.
 *
 * This hook owns the Unity instance ref so all SendMessage calls
 * go through one place.
 */

import { useCallback, useEffect, useRef } from "react";
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
} from "@/lib/bridge/sender";
import { useAuth } from "./useAuth";
import { useGameSession } from "./useGameSession";
import { useMarketplace } from "./useMarketplace";
import { devConsole } from "@/lib/devConsole";

export function useUnityBridge() {
  const unityInstanceRef = useRef<any>(null);

  const auth = useAuth();
  const session = useGameSession();
  const marketplace = useMarketplace();

  // Attach receiver once on mount
  useEffect(() => {
    attachBridgeReceiver();
    return () => detachBridgeReceiver();
  }, []);

  /**
   * Called by UnityGamePlayer when the Unity instance is ready.
   * Immediately sends auth state so Unity can unblock its loading screen.
   */
  const onUnityInstanceReady = useCallback(
    async (instance: any) => {
      unityInstanceRef.current = instance;
      devConsole.log("INFO", "unity:instanceReady", null);

      if (auth.isAuthenticated && auth.wallet) {
        const soulBalance = await auth.fetchSoulBalance();
        sendAuthReady(instance, {
          wallet: auth.wallet,
          soulBalance,
          playerId: auth.playerId ?? "",
        });
      }
    },
    [auth],
  );

  /**
   * Once auth is initialised (guest or upgraded), send OnAuthReady to Unity.
   * This handles the case where Unity loads before auth completes.
   */
  useEffect(() => {
    if (auth.isInitialising || !auth.isAuthenticated || !auth.wallet) return;
    const instance = unityInstanceRef.current;
    if (!instance) return;

    auth.fetchSoulBalance().then((balance) => {
      sendAuthReady(instance, {
        wallet: auth.wallet!,
        soulBalance: balance,
        playerId: auth.playerId ?? "",
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.isInitialising, auth.isAuthenticated]);

  // ── Inbound: gameplay_submission ─────────────────────────────────────────
  useEffect(() => {
    return onBridgeEvent("gameplay_submission", async (data) => {
      devConsole.log("BRIDGE_IN", "gameplay_submission", data);
      const result = await session.finishSession();
      if (result) {
        // Optionally re-fetch soul balance and push to Unity after session ends
        const balance = await auth.fetchSoulBalance();
        sendAuthReady(unityInstanceRef.current, {
          wallet: auth.wallet ?? "",
          soulBalance: balance,
          playerId: auth.playerId ?? "",
        });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.finishSession]);

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
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketplace.purchase]);

  // ── Inbound: marketplace_rent ─────────────────────────────────────────────
  useEffect(() => {
    return onBridgeEvent(
      "marketplace_rent",
      async ({ typeId, tierId, paymentToken }) => {
        const result = await marketplace.rent(typeId, tierId, paymentToken);
        sendPurchaseResult(unityInstanceRef.current, result);
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketplace.rent]);

  /**
   * Called by UnityGamePlayer when Unity signals it's ready to play.
   * Starts a session and sends sessionId back to Unity.
   */
  const startGameSession = useCallback(async () => {
    const res = await session.beginSession();
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
