"use client";

/**
 * components/dev/PlayerSection.tsx
 *
 * Drop this into app/dev/page.tsx alongside the other sections.
 * Shows full player profile — balances, owned NFTs, rented NFTs.
 * Accepts an optional `refreshTrigger` number that increments after
 * a buy/rent so the profile auto-refreshes.
 */

import { useCallback, useEffect, useState } from "react";
import {
  getMyProfile,
  getOwnedTypeIds,
  getRentedTypeIds,
  type PlayerProfile,
} from "@/lib/api/player";

// ── Design tokens (match dev page) ───────────────────────────────────────────

const C = {
  bg: "#060910",
  surface: "#0c1018",
  border: "rgba(255,255,255,0.06)",
  cyan: "#00d4ff",
  green: "#00ff88",
  gold: "#ffd700",
  orange: "#ff8c00",
  purple: "#c084fc",
  red: "#ff4455",
  dim: "#334155",
  muted: "#475569",
  text: "#cbd5e1",
  mono: "'JetBrains Mono', 'Fira Code', monospace",
  display: "'Rajdhani', 'Chakra Petch', sans-serif",
};

function Pill({
  label,
  value,
  color = C.text,
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 2,
        background: "rgba(0,0,0,0.3)",
        border: `1px solid ${C.border}`,
        borderRadius: 4,
        padding: "6px 10px",
        minWidth: 100,
      }}
    >
      <span
        style={{
          color: C.muted,
          fontSize: 9,
          fontFamily: C.mono,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <span
        style={{
          color,
          fontFamily: C.mono,
          fontSize: 12,
          wordBreak: "break-all",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function NFTCard({
  nft,
  color,
}: {
  nft: PlayerProfile["nfts"][0];
  color: string;
}) {
  return (
    <div
      style={{
        background: "rgba(0,0,0,0.3)",
        border: `1px solid ${color}33`,
        borderRadius: 4,
        padding: "8px 10px",
        fontSize: 10,
        fontFamily: C.mono,
        display: "grid",
        gridTemplateColumns: "70px 1fr",
        gap: "4px 10px",
      }}
    >
      {[
        ["typeId", nft.typeId],
        [
          "tokenId",
          nft.tokenId.length > 20
            ? `${nft.tokenId.slice(0, 18)}…`
            : nft.tokenId,
        ],
        ["status", nft.isRented ? "rented" : "owned"],
        ["since", new Date(nft.createdAt).toLocaleDateString()],
        ...(nft.rentedUntil
          ? [["until", new Date(nft.rentedUntil).toLocaleDateString()]]
          : []),
      ].map(([k, v]) => (
        <>
          <span key={`k-${k}`} style={{ color: C.muted }}>
            {k}
          </span>
          <span
            key={`v-${k}`}
            style={{ color: k === "status" ? color : C.text }}
          >
            {String(v)}
          </span>
        </>
      ))}
    </div>
  );
}

interface PlayerSectionProps {
  /** Increment this after a buy/rent to trigger an auto-refresh */
  refreshTrigger?: number;
}

export default function PlayerSection({
  refreshTrigger = 0,
}: PlayerSectionProps) {
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<number | null>(null);

  const fetch = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const p = await getMyProfile();
      setProfile(p);
      setStatus("ok");
      setLastRefresh(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch profile");
      setStatus("error");
    }
  }, []);

  // Auto-refresh when refreshTrigger changes (after buy/rent)
  useEffect(() => {
    if (refreshTrigger > 0) fetch();
  }, [refreshTrigger, fetch]);

  const owned = profile ? getOwnedTypeIds(profile) : [];
  const rented = profile ? getRentedTypeIds(profile) : [];

  return (
    <div
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderTop: `2px solid ${C.cyan}`,
        borderRadius: "0 0 6px 6px",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            color: C.cyan,
            fontFamily: C.display,
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "0.15em",
            textTransform: "uppercase",
          }}
        >
          Player Profile
        </span>
        <div style={{ flex: 1, height: 1, background: `${C.cyan}22` }} />
        {lastRefresh && (
          <span style={{ color: C.dim, fontSize: 9, fontFamily: C.mono }}>
            refreshed{" "}
            {new Date(lastRefresh).toLocaleTimeString("en-GB", {
              hour12: false,
            })}
          </span>
        )}
      </div>

      {/* Fetch button */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button
          onClick={fetch}
          disabled={status === "loading"}
          style={{
            background: "transparent",
            border: `1px solid ${status === "loading" ? C.dim : C.cyan + "55"}`,
            color: status === "loading" ? C.dim : C.cyan,
            borderRadius: 4,
            padding: "6px 14px",
            fontSize: 11,
            fontFamily: C.mono,
            cursor: status === "loading" ? "not-allowed" : "pointer",
            letterSpacing: "0.08em",
          }}
        >
          {status === "loading" ? "Loading..." : "GET /players/me"}
        </button>
        {status === "error" && (
          <span style={{ color: C.red, fontSize: 10, fontFamily: C.mono }}>
            {error}
          </span>
        )}
      </div>

      {profile && (
        <>
          {/* Identity + balances */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            <Pill
              label="playerId"
              value={`${profile.id.slice(0, 8)}…`}
              color={C.cyan}
            />
            <Pill
              label="type"
              value={profile.isGuest ? "guest" : "registered"}
              color={profile.isGuest ? C.gold : C.green}
            />
            <Pill
              label="SOUL balance"
              value={profile.soulBalance}
              color={C.gold}
            />
            <Pill
              label="GODS balance"
              value={profile.godsBalance}
              color={C.purple}
            />
          </div>

          {/* Ownership summary */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <Pill
              label="owned typeIds"
              value={owned.length > 0 ? owned.join(", ") : "none"}
              color={C.green}
            />
            <Pill
              label="rented typeIds"
              value={rented.length > 0 ? rented.join(", ") : "none"}
              color={C.orange}
            />
            <Pill label="achievements" value={profile.achievements.length} />
          </div>

          {/* NFT list */}
          {profile.nfts.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span
                style={{
                  color: C.muted,
                  fontSize: 9,
                  fontFamily: C.mono,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}
              >
                NFTs ({profile.nfts.length})
              </span>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                  gap: 6,
                }}
              >
                {profile.nfts.map((nft) => (
                  <NFTCard
                    key={nft.id}
                    nft={nft}
                    color={nft.isRented ? C.orange : C.green}
                  />
                ))}
              </div>
            </div>
          ) : (
            <span style={{ color: C.dim, fontSize: 10, fontFamily: C.mono }}>
              No NFTs yet — buy or rent an upgrade to see them here.
            </span>
          )}

          {/* Leaderboard entries */}
          {profile.leaderboard.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span
                style={{
                  color: C.muted,
                  fontSize: 9,
                  fontFamily: C.mono,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}
              >
                Leaderboard entries
              </span>
              {profile.leaderboard.map((entry) => (
                <div
                  key={entry.id}
                  style={{
                    background: "rgba(0,0,0,0.3)",
                    border: `1px solid ${C.border}`,
                    borderRadius: 4,
                    padding: "6px 10px",
                    fontSize: 10,
                    fontFamily: C.mono,
                    display: "flex",
                    gap: 16,
                    flexWrap: "wrap",
                  }}
                >
                  {[
                    ["game", entry.gameId],
                    ["mode", entry.modeId],
                    ["score", entry.score],
                    ["played", entry.gamesPlayed],
                    ["rounds", entry.roundsSurvived],
                    ["kills", entry.enemiesKilled],
                  ].map(([k, v]) => (
                    <span key={String(k)}>
                      <span style={{ color: C.muted }}>{k} </span>
                      <span style={{ color: C.text }}>{v}</span>
                    </span>
                  ))}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
