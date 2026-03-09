/**
 * lib/api/session.ts
 *
 * Covers:
 *   POST /sessions/start
 *   POST /sessions/earn
 *   POST /sessions/end
 *   GET  /sessions/:id
 */

import { apiRequest } from "./client";

export interface SessionStartResponse {
  id: string;
  playerId: string;
  gameId: number;
  modeId: number;
  status: string;
  createdAt: string;
}

export interface SessionEarnResponse {
  sessionId: string;
  soulEarned: string;
}

export interface SessionEndResponse {
  sessionId: string;
  totalSoulEarned: string;
  status: string;
}

export interface SessionDetails {
  id: string;
  playerId: string;
  gameId: number;
  modeId: number;
  status: string;
  soulEarned: string;
  createdAt: string;
  endedAt: string | null;
}

const GAME_ID = Number(process.env.NEXT_PUBLIC_GAME_ID ?? 1);
const MODE_ID = Number(process.env.NEXT_PUBLIC_SURVIVAL_MODE_ID ?? 1);

export async function startSession(): Promise<SessionStartResponse> {
  return apiRequest<SessionStartResponse>("/sessions/start", {
    method: "POST",
    body: { gameId: GAME_ID, modeId: MODE_ID },
  });
}

/**
 * Fire-and-forget during gameplay. Caller should not await in hot path.
 */
export async function earnSoul(
  sessionId: string,
  amount: string,
): Promise<SessionEarnResponse> {
  console.log(`POST to sessions/earn, ID: ${sessionId}, amount: ${amount}`);
  return apiRequest<SessionEarnResponse>("/sessions/earn", {
    method: "POST",
    body: { sessionId, amount },
  });
}

export async function endSession(
  sessionId: string,
): Promise<SessionEndResponse> {
  console.log(`POST to sessions/end, ID: ${sessionId}`);
  return apiRequest<SessionEndResponse>("/sessions/end", {
    method: "POST",
    body: { sessionId },
  });
}

export async function getSession(sessionId: string): Promise<SessionDetails> {
  return apiRequest<SessionDetails>(`/sessions/${sessionId}`);
}
