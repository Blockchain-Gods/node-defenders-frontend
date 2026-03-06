/**
 * lib/api/auth.ts
 *
 * Covers:
 *   POST /auth/guest   — create guest player + custodial wallet
 *   POST /auth/login   — Web3Auth or SIWE login
 */

import { apiRequest } from "./client";

export interface AuthResponse {
  token: string;
  playerId: string;
  wallet: string;
}

export interface LoginDto {
  type: "web3auth" | "siwe";
  idToken?: string;
  message?: string;
  signature?: string;
}

/**
 * Create a guest player. Called on first visit when no JWT exists.
 * Returns a 30-day JWT + custodial wallet address.
 */
export async function loginAsGuest(): Promise<AuthResponse> {
  return apiRequest<AuthResponse>("/auth/guest", {
    method: "POST",
    public: true,
  });
}

/**
 * Authenticate via Web3Auth (custodial social login) or SIWE (self-custody).
 * Overwrites guest session on the client after a successful call.
 */
export async function login(dto: LoginDto): Promise<AuthResponse> {
  return apiRequest<AuthResponse>("/auth/login", {
    method: "POST",
    body: dto,
    public: true,
  });
}

/**
 * Decode JWT expiry without a library.
 * Returns expiry as Unix timestamp (seconds), or null if invalid.
 */
export function decodeJwtExpiry(token: string): number | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const decoded = JSON.parse(
      atob(payload.replace(/-/g, "+").replace(/_/g, "/")),
    );
    return typeof decoded.exp === "number" ? decoded.exp : null;
  } catch {
    return null;
  }
}

/**
 * Returns true if the token is valid and has more than `thresholdDays` remaining.
 */
export function isTokenFresh(token: string, thresholdDays = 2): boolean {
  const exp = decodeJwtExpiry(token);
  if (!exp) return false;
  const nowSec = Math.floor(Date.now() / 1000);
  const remainingSec = exp - nowSec;
  return remainingSec > thresholdDays * 24 * 60 * 60;
}
