/**
 * lib/api/leaderboard.ts
 */

import { apiRequest } from "./client";

export interface LeaderboardEntry {
  rank: number;
  playerId: string;
  playerName?: string;
  walletAddress: string;
  score: number;
  gamesPlayed: number;
  roundsSurvived: number;
  enemiesKilled: number;
}

export interface LeaderboardResponse {
  gameId: number;
  modeId: number;
  entries: LeaderboardEntry[];
}

export interface SubmitLeaderboardDto {
  gameId: number;
  modeId: number;
  score: number;
  gamesPlayed: number;
  roundsSurvived: number;
  enemiesKilled: number;
}

export async function getLeaderboard(
  gameId: number,
  modeId: number,
): Promise<LeaderboardResponse> {
  return apiRequest<LeaderboardResponse>(`/leaderboard/${gameId}/${modeId}`, {
    public: true,
  });
}

export async function submitLeaderboard(
  dto: SubmitLeaderboardDto,
): Promise<void> {
  return apiRequest<void>("/leaderboard/submit", {
    method: "POST",
    body: dto,
  });
}
