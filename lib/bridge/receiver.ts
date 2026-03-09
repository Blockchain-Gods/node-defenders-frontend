/**
 * lib/bridge/receiver.ts
 *
 * Listens to window "message" events from Unity (via GameInterop.jslib)
 * and re-dispatches them as typed CustomEvents so hooks can subscribe
 * without coupling to the raw postMessage format.
 *
 * Custom events dispatched:
 *   "nd:gameplay_submission"
 *   "nd:marketplace_open"
 *   "nd:marketplace_buy"
 *   "nd:marketplace_rent"
 *
 * Also handles the legacy "unity-analytics" CustomEvent path
 * (fired by the existing GameInterop.jslib) so we don't need a
 * Unity rebuild to get started.
 */

import { devConsole } from "@/lib/devConsole";
import type { UnityInboundEvent } from "./types";

const KNOWN_TYPES = new Set([
  "gameplay_submission",
  "marketplace_open",
  "marketplace_buy",
  "marketplace_rent",
  "beta_session_end",
]);

function dispatch(type: string, data: unknown) {
  devConsole.log("BRIDGE_IN", type, data);
  window.dispatchEvent(new CustomEvent(`nd:${type}`, { detail: data }));
}

function handleMessage(event: MessageEvent) {
  // Only accept same-origin messages
  if (event.origin !== window.location.origin) return;

  const msg = event.data as { type?: string; data?: unknown };
  if (!msg?.type || !KNOWN_TYPES.has(msg.type)) return;

  dispatch(msg.type, msg.data ?? null);
}

// Legacy path: existing jslib fires "unity-analytics" CustomEvent directly
function handleLegacyAnalytics(event: Event) {
  const detail = (event as CustomEvent).detail;
  dispatch("gameplay_submission", detail);
}

let attached = false;

export function attachBridgeReceiver() {
  if (attached || typeof window === "undefined") return;
  attached = true;
  window.addEventListener("message", handleMessage);
  window.addEventListener("unity-analytics", handleLegacyAnalytics);
}

export function detachBridgeReceiver() {
  if (!attached) return;
  attached = false;
  window.removeEventListener("message", handleMessage);
  window.removeEventListener("unity-analytics", handleLegacyAnalytics);
}

/**
 * Subscribe to a typed inbound bridge event.
 * Returns an unsubscribe function.
 */
export function onBridgeEvent<T extends UnityInboundEvent["type"]>(
  type: T,
  handler: (data: Extract<UnityInboundEvent, { type: T }>["data"]) => void,
): () => void {
  const listener = (event: Event) => {
    handler((event as CustomEvent).detail);
  };
  window.addEventListener(`nd:${type}`, listener);
  return () => window.removeEventListener(`nd:${type}`, listener);
}
