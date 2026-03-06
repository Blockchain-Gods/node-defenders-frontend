/**
 * lib/api/soul.ts
 */

import { apiRequest } from "./client";

export interface SoulBalanceResponse {
  balance: string;
  playerId: string;
}

export async function getSoulBalance(): Promise<SoulBalanceResponse> {
  return apiRequest<SoulBalanceResponse>("/soul/balance");
}
