/**
 * lib/bridge/types.ts
 *
 * Typed contract for all Unity ↔ JS communication.
 *
 * UNITY → JS (postMessage from GameInterop.jslib):
 *   gameplay_submission  — game over, analytics payload
 *   marketplace_open     — player opened Market tab
 *   marketplace_buy      — player confirmed buy
 *   marketplace_rent     — player confirmed rent
 *
 * JS → UNITY (SendMessage via unityInstance):
 *   OnAuthReady          — JWT auth complete, send wallet + balance
 *   OnSessionStarted     — session created, send sessionId
 *   OnMarketplaceData    — listings response
 *   OnPurchaseResult     — buy/rent outcome
 */

// ─── Unity → JS ──────────────────────────────────────────────────────────────

export interface GameplaySubmissionPayload {
  total_score?: number;
  total_levels_completed?: number;
  total_playtime_seconds?: number;
  session_ended_at?: number;
  level_completions?: Array<{
    completion_time_seconds: number;
    started_at?: number;
  }>;
  all_resource_transactions?: unknown[];
  all_tower_placements?: unknown[];
  enemies_killed?: number;
  rounds_survived?: number;
}

export interface MarketplaceOpenPayload {
  soulBalance?: string;
}

export interface MarketplaceBuyPayload {
  typeId: number;
  paymentToken: "SOUL" | "GODS";
}

export interface MarketplaceRentPayload {
  typeId: number;
  tierId: number;
  paymentToken: "SOUL" | "GODS";
}

export type UnityInboundEvent =
  | { type: "gameplay_submission"; data: GameplaySubmissionPayload }
  | { type: "marketplace_open"; data: MarketplaceOpenPayload }
  | { type: "marketplace_buy"; data: MarketplaceBuyPayload }
  | { type: "marketplace_rent"; data: MarketplaceRentPayload };

// ─── JS → Unity ──────────────────────────────────────────────────────────────

export interface OnAuthReadyPayload {
  wallet: string;
  soulBalance: string;
  playerId: string;
}

export interface OnSessionStartedPayload {
  sessionId: string;
}

export interface OnMarketplaceDataPayload {
  listings: unknown[];
}

export interface OnPurchaseResultPayload {
  success: boolean;
  error?: string;
  txHash?: string;
  nftTokenId?: string;
}

export type UnityOutboundMessage =
  | { method: "OnAuthReady"; payload: OnAuthReadyPayload }
  | { method: "OnSessionStarted"; payload: OnSessionStartedPayload }
  | { method: "OnMarketplaceData"; payload: OnMarketplaceDataPayload }
  | { method: "OnPurchaseResult"; payload: OnPurchaseResultPayload };
