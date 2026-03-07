/**
 * lib/api/marketplace.ts
 */

import { apiRequest } from "./client";

export type PaymentToken = "SOUL" | "GODS";

export interface MarketplaceItem {
  typeId: number;
  name: string;
  description?: string;
  imageUrl?: string;
  power?: number;
  range?: number;
  speed?: number;
}

export interface MarketplaceListing {
  typeId: number;
  name: string;
  description: string;
  image: string;
  rarity: string;
  buyPriceSoul: string;
  buyPriceGods: string;
  listed: boolean;
  attributes: Array<{
    trait_type: string;
    value: string | number;
    display_type?: string;
  }>;
}

export interface RentTier {
  tierId: number;
  durationGames: number;
  priceSoul?: string;
  priceGods?: string;
}

export interface ListingsResponse {
  listings: MarketplaceListing[];
}

export interface BuyResponse {
  success: boolean;
  txHash?: string;
  nftTokenId?: string;
  message?: string;
}

export interface RentResponse {
  success: boolean;
  txHash?: string;
  nftTokenId?: string;
  expiresAfterGames?: number;
  message?: string;
}

// typeIds registered on-chain but not yet active in the game UI.
// Extend this set when adding placeholders — Unity and players will never see these.
const HIDDEN_TYPE_IDS = new Set([1, 2]);

export async function getListings(): Promise<ListingsResponse> {
  const res = await apiRequest<unknown>("/marketplace/listings", {
    public: true,
  });

  const listings = Array.isArray(res)
    ? res
    : ((res as ListingsResponse).listings ?? []);

  return {
    listings: listings.filter((l) => !HIDDEN_TYPE_IDS.has(l.typeId)),
  };
}

export async function buyItem(
  typeId: number,
  paymentToken: PaymentToken,
): Promise<BuyResponse> {
  return apiRequest<BuyResponse>("/marketplace/buy", {
    method: "POST",
    body: { typeId, paymentToken },
  });
}

export async function rentItem(
  typeId: number,
  tierId: number,
  paymentToken: PaymentToken,
): Promise<RentResponse> {
  return apiRequest<RentResponse>("/marketplace/rent", {
    method: "POST",
    body: { typeId, tierId, paymentToken },
  });
}
