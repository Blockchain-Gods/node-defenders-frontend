/**
 * lib/api/player.ts
 *
 * Covers:
 *   GET /players/me       — authenticated player's full profile
 *   GET /players/:id/profile — player profile by ID
 */

import { apiRequest } from "./client";

export interface PlayerNFT {
  id: string;
  tokenId: string;
  typeId: number;
  isRented: boolean;
  rentedUntil: string | null;
  createdAt: string;
}

export interface SbtAchievement {
  id: string;
  tokenId: string;
  typeId: number;
  name: string;
  mintedAt: string;
}

export interface LeaderboardEntry {
  id: string;
  gameId: number;
  modeId: number;
  score: number;
  gamesPlayed: number;
  roundsSurvived: number;
  enemiesKilled: number;
  updatedAt: string;
}

export interface PlayerProfile {
  id: string;
  walletAddress: string;
  isGuest: boolean;
  soulBalance: string;
  godsBalance: string;
  createdAt: string;
  nfts: PlayerNFT[];
  achievements: SbtAchievement[];
  leaderboard: LeaderboardEntry[];
}

export async function getMyProfile(): Promise<PlayerProfile> {
  return apiRequest<PlayerProfile>("/players/me");
}

export async function getPlayerProfile(
  playerId: string,
): Promise<PlayerProfile> {
  return apiRequest<PlayerProfile>(`/players/${playerId}/profile`);
}

/**
 * Returns typeIds the player currently owns (not rented).
 */
export function getOwnedTypeIds(profile: PlayerProfile): number[] {
  return profile.nfts.filter((n) => !n.isRented).map((n) => n.typeId);
}

/**
 * Returns typeIds the player currently has rented.
 */
export function getRentedTypeIds(profile: PlayerProfile): number[] {
  return profile.nfts.filter((n) => n.isRented).map((n) => n.typeId);
}
