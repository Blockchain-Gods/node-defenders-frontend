/**
 * lib/bridge/sender.ts
 *
 * Typed wrapper around unityInstance.SendMessage.
 * All outbound messages go through here so devConsole captures them
 * and the call site stays type-safe.
 *
 * Unity C# target: GameManager GameObject
 * Methods expected on GameManager:
 *   OnAuthReady(string json)
 *   OnSessionStarted(string json)
 *   OnMarketplaceData(string json)
 *   OnPurchaseResult(string json)
 */

import { devConsole } from "@/lib/devConsole";
import type {
  OnAuthReadyPayload,
  OnSessionStartedPayload,
  OnMarketplaceDataPayload,
  OnPurchaseResultPayload,
} from "./types";

interface UnityInstance {
  SendMessage: (gameObject: string, method: string, param: string) => void;
}

const GAME_OBJECT = "GameManager";

function send(
  instance: UnityInstance | null,
  method: string,
  payload: unknown,
) {
  if (!instance) {
    console.log("ERROR", `BRIDGE_OUT:${method}`, payload, {
      error: "Unity instance not ready",
    });
    return;
  }

  const json = JSON.stringify(payload);
  console.log("BRIDGE_OUT", method, payload);

  try {
    instance.SendMessage(GAME_OBJECT, method, json);
  } catch (err) {
    console.log("ERROR", `BRIDGE_OUT:${method}`, payload, {
      error: err instanceof Error ? err.message : "SendMessage failed",
    });
  }
}

export function sendAuthReady(
  instance: UnityInstance | null,
  payload: OnAuthReadyPayload,
) {
  send(instance, "OnAuthReady", payload);
}

export function sendSessionStarted(
  instance: UnityInstance | null,
  payload: OnSessionStartedPayload,
) {
  send(instance, "OnSessionStarted", payload);
}

export function sendMarketplaceData(
  instance: UnityInstance | null,
  payload: OnMarketplaceDataPayload,
) {
  send(instance, "OnMarketplaceData", payload);
}

export function sendPurchaseResult(
  instance: UnityInstance | null,
  payload: OnPurchaseResultPayload,
) {
  send(instance, "OnPurchaseResult", payload);
}

/**
 * Generic SendMessage for dynamic game object / method targets.
 * Used for responses where Unity passes its own GO name (e.g. DataParser).
 */
export function sendRawMessage(
  instance: UnityInstance | null,
  gameObject: string,
  method: string,
  json: string,
) {
  if (!instance) {
    devConsole.log("ERROR", `BRIDGE_OUT:${method}`, null, {
      error: "Unity instance not ready",
    });
    return;
  }
  devConsole.log("BRIDGE_OUT", `${gameObject}.${method}`, json);
  try {
    instance.SendMessage(gameObject, method, json);
  } catch (err) {
    devConsole.log("ERROR", `BRIDGE_OUT:${method}`, null, {
      error: err instanceof Error ? err.message : "SendMessage failed",
    });
  }
}
