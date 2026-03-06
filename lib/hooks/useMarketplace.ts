/**
 * lib/hooks/useMarketplace.ts
 *
 * Fetches listings and handles buy/rent flows.
 * Called by useUnityBridge when Unity fires marketplace events.
 */

import { useCallback, useState } from "react";
import {
  getListings,
  buyItem,
  rentItem,
  type MarketplaceListing,
  type PaymentToken,
} from "@/lib/api/marketplace";
import { devConsole } from "@/lib/devConsole";

export function useMarketplace() {
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchListings = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await getListings();
      setListings(res.listings);
      return res.listings;
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to fetch listings";
      setError(msg);
      devConsole.log("ERROR", "marketplace:listings:failed", null, {
        error: msg,
      });
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  const purchase = useCallback(
    async (typeId: number, paymentToken: PaymentToken) => {
      try {
        setError(null);
        const res = await buyItem(typeId, paymentToken);
        return {
          success: res.success,
          txHash: res.txHash,
          nftTokenId: res.nftTokenId,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Purchase failed";
        setError(msg);
        return { success: false, error: msg };
      }
    },
    [],
  );

  const rent = useCallback(
    async (typeId: number, tierId: number, paymentToken: PaymentToken) => {
      try {
        setError(null);
        const res = await rentItem(typeId, tierId, paymentToken);
        return {
          success: res.success,
          txHash: res.txHash,
          nftTokenId: res.nftTokenId,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Rent failed";
        setError(msg);
        return { success: false, error: msg };
      }
    },
    [],
  );

  return {
    listings,
    isLoading,
    error,
    fetchListings,
    purchase,
    rent,
  };
}
