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
  id: number;
  typeId: number;
  item: MarketplaceItem;
  buyPriceSoul?: string;
  buyPriceGods?: string;
  rentTiers?: RentTier[];
  isAvailable: boolean;
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

export async function getListings(): Promise<ListingsResponse> {
  return apiRequest<ListingsResponse>("/marketplace/listings", {
    public: true,
  });
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
