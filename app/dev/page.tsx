"use client";

/**
 * app/dev/page.tsx
 *
 * Beta API harness — real calls to node-defenders-api.
 * Blocked in production (NEXT_PUBLIC_DEV_MODE !== "true").
 *
 * Sections: Auth · Session · Soul · Leaderboard · Marketplace · Bridge
 */

import { useEffect, useReducer, useRef, useState } from "react";
import { redirect } from "next/navigation";
import { useAuthStore } from "@/lib/store/authStore";
import {
  loginAsGuest,
  login,
  isTokenFresh,
  decodeJwtExpiry,
} from "@/lib/api/auth";
import { startSession, earnSoul, endSession } from "@/lib/api/session";
import { getSoulBalance } from "@/lib/api/soul";
import { getLeaderboard, submitLeaderboard } from "@/lib/api/leaderboard";
import { getListings, buyItem, rentItem } from "@/lib/api/marketplace";
import DevConsole from "@/components/DevConsole";
import { devConsole } from "@/lib/devConsole";
import { attachBridgeReceiver, onBridgeEvent } from "@/lib/bridge/receiver";

import PlayerSection from "@/components/dev/PlayerSection";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SectionResult {
  status: "idle" | "loading" | "ok" | "error";
  data?: unknown;
  error?: string;
  ts?: number;
}

type Results = Record<string, SectionResult>;

function useResults() {
  const [results, update] = useReducer(
    (state: Results, patch: Record<string, SectionResult>) => ({
      ...state,
      ...patch,
    }),
    {},
  );
  const set = (key: string, val: SectionResult) => update({ [key]: val });
  const loading = (key: string) => set(key, { status: "loading" });
  const ok = (key: string, data: unknown) =>
    set(key, { status: "ok", data, ts: Date.now() });
  const err = (key: string, e: unknown) =>
    set(key, {
      status: "error",
      error: e instanceof Error ? e.message : String(e),
      ts: Date.now(),
    });
  return { results, loading, ok, err };
}

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
  bg: "#060910",
  surface: "#0c1018",
  border: "rgba(255,255,255,0.06)",
  borderHi: "rgba(0,212,255,0.25)",
  cyan: "#00d4ff",
  green: "#00ff88",
  gold: "#ffd700",
  orange: "#ff8c00",
  purple: "#c084fc",
  red: "#ff4455",
  dim: "#334155",
  muted: "#475569",
  text: "#cbd5e1",
  mono: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
  display: "'Rajdhani', 'Chakra Petch', sans-serif",
};

// ─── Primitives ───────────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        color: C.muted,
        fontSize: 10,
        fontFamily: C.mono,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
      }}
    >
      {children}
    </span>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  style,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        background: "rgba(0,0,0,0.4)",
        border: `1px solid ${C.border}`,
        borderRadius: 4,
        color: C.text,
        fontFamily: C.mono,
        fontSize: 11,
        padding: "5px 8px",
        outline: "none",
        width: "100%",
        transition: "border-color 0.15s",
        ...style,
      }}
      onFocus={(e) => (e.currentTarget.style.borderColor = C.cyan + "66")}
      onBlur={(e) => (e.currentTarget.style.borderColor = C.border)}
    />
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        background: "#0c1018",
        border: `1px solid ${C.border}`,
        borderRadius: 4,
        color: C.text,
        fontFamily: C.mono,
        fontSize: 11,
        padding: "5px 8px",
        outline: "none",
        cursor: "pointer",
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function Btn({
  onClick,
  children,
  color = C.cyan,
  disabled = false,
  small = false,
}: {
  onClick: () => void;
  children: React.ReactNode;
  color?: string;
  disabled?: boolean;
  small?: boolean;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: hover && !disabled ? `${color}18` : "transparent",
        border: `1px solid ${disabled ? C.dim : color + "55"}`,
        color: disabled ? C.dim : color,
        borderRadius: 4,
        padding: small ? "3px 10px" : "6px 14px",
        fontSize: small ? 10 : 11,
        fontFamily: C.mono,
        letterSpacing: "0.08em",
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "all 0.12s",
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

function StatusDot({ status }: { status: SectionResult["status"] }) {
  const map = {
    idle: C.dim,
    loading: C.gold,
    ok: C.green,
    error: C.red,
  };
  const glow =
    status === "loading"
      ? `0 0 6px ${C.gold}`
      : status === "ok"
        ? `0 0 6px ${C.green}`
        : status === "error"
          ? `0 0 6px ${C.red}`
          : "none";
  return (
    <span
      style={{
        display: "inline-block",
        width: 6,
        height: 6,
        borderRadius: "50%",
        background: map[status],
        boxShadow: glow,
        flexShrink: 0,
        transition: "all 0.2s",
        ...(status === "loading" ? { animation: "pulse 1s infinite" } : {}),
      }}
    />
  );
}

function ResultBlock({ result }: { result?: SectionResult }) {
  const [expanded, setExpanded] = useState(false);
  if (!result || result.status === "idle") return null;

  const isErr = result.status === "error";
  const color = isErr ? C.red : C.green;

  return (
    <div
      style={{
        marginTop: 8,
        background: "rgba(0,0,0,0.35)",
        border: `1px solid ${color}22`,
        borderRadius: 4,
        overflow: "hidden",
      }}
    >
      <div
        onClick={() => result.data !== undefined && setExpanded((e) => !e)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "5px 10px",
          cursor: result.data !== undefined ? "pointer" : "default",
          borderBottom: expanded ? `1px solid ${color}11` : "none",
        }}
      >
        <StatusDot status={result.status} />
        <span style={{ color, fontFamily: C.mono, fontSize: 10, flex: 1 }}>
          {isErr ? result.error : "OK"}
        </span>
        {result.ts && (
          <span style={{ color: C.dim, fontFamily: C.mono, fontSize: 9 }}>
            {new Date(result.ts).toLocaleTimeString("en-GB", { hour12: false })}
          </span>
        )}
        {result.data !== undefined && (
          <span style={{ color: C.dim, fontSize: 9 }}>
            {expanded ? "▲" : "▼"}
          </span>
        )}
      </div>
      {expanded && result.data !== undefined && (
        <pre
          style={{
            margin: 0,
            padding: "8px 10px",
            fontSize: 10,
            color: color,
            fontFamily: C.mono,
            overflowX: "auto",
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
            maxHeight: 220,
            overflowY: "auto",
          }}
        >
          {JSON.stringify(result.data, null, 2)}
        </pre>
      )}
    </div>
  );
}

function Section({
  title,
  accent = C.cyan,
  children,
}: {
  title: string;
  accent?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderTop: `2px solid ${accent}`,
        borderRadius: "0 0 6px 6px",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            color: accent,
            fontFamily: C.display,
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "0.15em",
            textTransform: "uppercase",
          }}
        >
          {title}
        </span>
        <div style={{ flex: 1, height: 1, background: `${accent}22` }} />
      </div>
      {children}
    </div>
  );
}

function Row({
  children,
  gap = 8,
}: {
  children: React.ReactNode;
  gap?: number;
}) {
  return (
    <div
      style={{ display: "flex", alignItems: "center", gap, flexWrap: "wrap" }}
    >
      {children}
    </div>
  );
}

// ─── Sections ─────────────────────────────────────────────────────────────────

function AuthSection() {
  const { jwt, playerId, wallet, authMethod, setAuth, clearAuth } =
    useAuthStore();
  const { results, loading, ok, err } = useResults();

  const expiry = jwt ? decodeJwtExpiry(jwt) : null;
  const fresh = jwt ? isTokenFresh(jwt, 2) : false;

  const doGuest = async () => {
    loading("guest");
    try {
      const res = await loginAsGuest();
      console.log("[AuthSection] res: ", res);
      setAuth(res.token, res.playerId, res.wallet, "guest");
      ok("guest", res);
    } catch (e) {
      err("guest", e);
    }
  };

  return (
    <Section title="Auth" accent={C.purple}>
      {/* Stored state */}
      <div
        style={{
          background: "rgba(0,0,0,0.3)",
          border: `1px solid ${C.border}`,
          borderRadius: 4,
          padding: "10px 12px",
          display: "grid",
          gridTemplateColumns: "80px 1fr",
          gap: "5px 12px",
          fontSize: 10,
          fontFamily: C.mono,
        }}
      >
        {[
          ["method", authMethod ?? "—"],
          ["playerId", playerId ?? "—"],
          ["wallet", wallet ?? "—"],
          ["jwt", jwt ? `${jwt.slice(0, 20)}…` : "—"],
          ["expiry", expiry ? new Date(expiry * 1000).toLocaleString() : "—"],
          ["fresh", jwt ? (fresh ? "✓ yes" : "⚠ < 2 days") : "—"],
        ].map(([k, v]) => (
          <>
            <span key={`k-${k}`} style={{ color: C.muted }}>
              {k}
            </span>
            <span
              key={`v-${k}`}
              style={{
                color: k === "fresh" && !fresh && jwt ? C.gold : C.text,
                wordBreak: "break-all",
              }}
            >
              {v}
            </span>
          </>
        ))}
      </div>

      <Row>
        <Btn onClick={doGuest} color={C.purple}>
          POST /auth/guest
        </Btn>
        <Btn onClick={() => clearAuth()} color={C.red} disabled={!jwt}>
          Clear auth
        </Btn>
      </Row>

      <ResultBlock result={results["guest"]} />
    </Section>
  );
}

function SessionSection() {
  const { results, loading, ok, err } = useResults();
  const [sessionId, setSessionId] = useState("");
  const [earnAmt, setEarnAmt] = useState("10");
  const activeRef = useRef<string | null>(null);

  const doStart = async () => {
    loading("start");
    try {
      const res = await startSession();
      activeRef.current = res.id;
      setSessionId(res.id);
      ok("start", res);
    } catch (e) {
      err("start", e);
    }
  };

  const doEarn = async () => {
    if (!sessionId) return;
    loading("earn");
    try {
      console.log("session_id: ", sessionId);
      const res = await earnSoul(sessionId, earnAmt);
      ok("earn", res);
    } catch (e) {
      err("earn", e);
    }
  };

  const doEnd = async () => {
    if (!sessionId) return;
    loading("end");
    try {
      const res = await endSession(sessionId);
      activeRef.current = null;
      ok("end", res);
    } catch (e) {
      err("end", e);
    }
  };

  return (
    <Section title="Session" accent={C.cyan}>
      <Row>
        <Label>Session ID</Label>
        <div style={{ flex: 1 }}>
          <Input
            value={sessionId}
            onChange={setSessionId}
            placeholder="auto-filled on start"
          />
        </div>
      </Row>

      <Row>
        <Btn onClick={doStart} color={C.cyan}>
          POST /sessions/start
        </Btn>
        <Btn onClick={doEnd} color={C.red} disabled={!sessionId}>
          POST /sessions/end
        </Btn>
      </Row>

      <Row>
        <Label>Earn SOUL</Label>
        <Input value={earnAmt} onChange={setEarnAmt} style={{ width: 80 }} />
        <Btn onClick={doEarn} color={C.green} disabled={!sessionId}>
          POST /sessions/earn
        </Btn>
      </Row>

      {["start", "earn", "end"].map((k) => (
        <ResultBlock key={k} result={results[k]} />
      ))}
    </Section>
  );
}

function SoulSection() {
  const { results, loading, ok, err } = useResults();

  const doBalance = async () => {
    loading("balance");
    try {
      ok("balance", await getSoulBalance());
    } catch (e) {
      err("balance", e);
    }
  };

  return (
    <Section title="Soul" accent={C.gold}>
      <Btn onClick={doBalance} color={C.gold}>
        GET /soul/balance
      </Btn>
      <ResultBlock result={results["balance"]} />
    </Section>
  );
}

function LeaderboardSection() {
  const { results, loading, ok, err } = useResults();
  const [gameId, setGameId] = useState("1");
  const [modeId, setModeId] = useState("1");
  const [score, setScore] = useState("1500");
  const [rounds, setRounds] = useState("5");
  const [kills, setKills] = useState("42");

  const doFetch = async () => {
    loading("fetch");
    try {
      ok("fetch", await getLeaderboard(+gameId, +modeId));
    } catch (e) {
      err("fetch", e);
    }
  };

  const doSubmit = async () => {
    loading("submit");
    try {
      ok(
        "submit",
        await submitLeaderboard({
          gameId: +gameId,
          modeId: +modeId,
          score: +score,
          gamesPlayed: 1,
          roundsSurvived: +rounds,
          enemiesKilled: +kills,
        }),
      );
    } catch (e) {
      err("submit", e);
    }
  };

  return (
    <Section title="Leaderboard" accent={C.orange}>
      <Row>
        <Label>gameId</Label>
        <Input value={gameId} onChange={setGameId} style={{ width: 60 }} />
        <Label>modeId</Label>
        <Input value={modeId} onChange={setModeId} style={{ width: 60 }} />
        <Btn onClick={doFetch} color={C.orange}>
          GET /leaderboard
        </Btn>
      </Row>

      <div style={{ height: 1, background: C.border }} />

      <Row>
        <Label>score</Label>
        <Input value={score} onChange={setScore} style={{ width: 70 }} />
        <Label>rounds</Label>
        <Input value={rounds} onChange={setRounds} style={{ width: 55 }} />
        <Label>kills</Label>
        <Input value={kills} onChange={setKills} style={{ width: 55 }} />
        <Btn onClick={doSubmit} color={C.orange}>
          POST /leaderboard/submit
        </Btn>
      </Row>

      {["fetch", "submit"].map((k) => (
        <ResultBlock key={k} result={results[k]} />
      ))}
    </Section>
  );
}

function MarketplaceSection() {
  const { results, loading, ok, err } = useResults();
  const [typeId, setTypeId] = useState("1");
  const [tierId, setTierId] = useState("1");
  const [token, setToken] = useState<"SOUL" | "GODS">("SOUL");

  const doListings = async () => {
    loading("listings");
    try {
      ok("listings", await getListings());
    } catch (e) {
      err("listings", e);
    }
  };

  const doBuy = async () => {
    loading("buy");
    try {
      ok("buy", await buyItem(+typeId, token));
    } catch (e) {
      err("buy", e);
    }
  };

  const doRent = async () => {
    loading("rent");
    try {
      ok("rent", await rentItem(+typeId, +tierId, token));
    } catch (e) {
      err("rent", e);
    }
  };

  return (
    <Section title="Marketplace" accent={C.green}>
      <Btn onClick={doListings} color={C.green}>
        GET /marketplace/listings
      </Btn>

      <div style={{ height: 1, background: C.border }} />

      <Row>
        <Label>typeId</Label>
        <Input value={typeId} onChange={setTypeId} style={{ width: 60 }} />
        <Label>token</Label>
        <Select
          value={token}
          onChange={(v) => setToken(v as "SOUL" | "GODS")}
          options={[
            { value: "SOUL", label: "SOUL" },
            { value: "GODS", label: "GODS" },
          ]}
        />
        <Btn onClick={doBuy} color={C.green}>
          POST /marketplace/buy
        </Btn>
      </Row>

      <Row>
        <Label>tierId</Label>
        <Input value={tierId} onChange={setTierId} style={{ width: 60 }} />
        <Btn onClick={doRent} color={C.cyan}>
          POST /marketplace/rent
        </Btn>
      </Row>

      {["listings", "buy", "rent"].map((k) => (
        <ResultBlock key={k} result={results[k]} />
      ))}
    </Section>
  );
}

function BridgeSection() {
  const [log, setLog] = useState<
    Array<{ type: string; data: unknown; ts: number }>
  >([]);

  const fire = (type: string, data: unknown) => {
    window.dispatchEvent(new CustomEvent(`nd:${type}`, { detail: data }));
  };

  // Listen for bridge events and show them inline too
  useEffect(() => {
    attachBridgeReceiver();
    const types = [
      "gameplay_submission",
      "marketplace_open",
      "marketplace_buy",
      "marketplace_rent",
      "beta_session_end",
    ];
    const unsubs = types.map((t) =>
      onBridgeEvent(t as any, (data) => {
        setLog((l) => [{ type: t, data, ts: Date.now() }, ...l].slice(0, 20));
      }),
    );
    return () => unsubs.forEach((u) => u());
  }, []);

  const mockEvents: Array<{
    label: string;
    type: string;
    data: unknown;
    color: string;
  }> = [
    {
      label: "gameplay_submission",
      color: C.gold,
      type: "gameplay_submission",
      data: {
        total_score: 2400,
        total_levels_completed: 4,
        total_playtime_seconds: 180,
        enemies_killed: 67,
        rounds_survived: 4,
      },
    },
    {
      label: "marketplace_open",
      color: C.cyan,
      type: "marketplace_open",
      data: { soulBalance: "500" },
    },
    {
      label: "marketplace_buy",
      color: C.green,
      type: "marketplace_buy",
      data: { typeId: 1, paymentToken: "SOUL" },
    },
    {
      label: "marketplace_rent",
      color: C.orange,
      type: "marketplace_rent",
      data: { typeId: 2, tierId: 1, paymentToken: "SOUL" },
    },
  ];

  return (
    <Section title="Bridge Mock" accent={C.gold}>
      <p
        style={{
          color: C.muted,
          fontFamily: C.mono,
          fontSize: 10,
          margin: 0,
          lineHeight: 1.6,
        }}
      >
        Fires <code style={{ color: C.gold }}>nd:*</code> CustomEvents that{" "}
        <code style={{ color: C.cyan }}>useUnityBridge</code> listens to — same
        path Unity uses.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {mockEvents.map((e) => (
          <Btn
            key={e.label}
            onClick={() => fire(e.type, e.data)}
            color={e.color}
          >
            ▶ {e.label}
          </Btn>
        ))}
      </div>

      {/* Inline event log */}
      {log.length > 0 && (
        <div
          style={{
            background: "rgba(0,0,0,0.35)",
            border: `1px solid ${C.border}`,
            borderRadius: 4,
            maxHeight: 160,
            overflowY: "auto",
          }}
        >
          {log.map((entry, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                gap: 8,
                alignItems: "flex-start",
                padding: "5px 10px",
                borderBottom:
                  i < log.length - 1 ? `1px solid ${C.border}` : "none",
                fontSize: 10,
                fontFamily: C.mono,
              }}
            >
              <span style={{ color: C.dim, flexShrink: 0 }}>
                {new Date(entry.ts).toLocaleTimeString("en-GB", {
                  hour12: false,
                })}
              </span>
              <span style={{ color: C.gold, flexShrink: 0 }}>{entry.type}</span>
              <span style={{ color: C.muted, wordBreak: "break-all" }}>
                {JSON.stringify(entry.data)}
              </span>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DevPage() {
  const [purchaseCount, setPurchaseCount] = useState(0);
  // Block in production
  if (process.env.NEXT_PUBLIC_DEV_MODE !== "true") {
    redirect("/");
  }

  useEffect(() => {
    devConsole.init();
  }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          background: ${C.bg};
          min-height: 100vh;
        }

        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(0,212,255,0.2); border-radius: 2px; }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }

        @keyframes scanline {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100vh); }
        }
      `}</style>

      <div
        style={{
          minHeight: "100vh",
          background: C.bg,
          fontFamily: C.mono,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Grid background */}
        <div
          style={{
            position: "fixed",
            inset: 0,
            pointerEvents: "none",
            zIndex: 0,
            backgroundImage: `
            linear-gradient(rgba(0,212,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,212,255,0.03) 1px, transparent 1px)
          `,
            backgroundSize: "40px 40px",
          }}
        />

        {/* Scanline */}
        <div
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            height: 2,
            background:
              "linear-gradient(90deg, transparent, rgba(0,212,255,0.06), transparent)",
            animation: "scanline 8s linear infinite",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />

        <div
          style={{
            position: "relative",
            zIndex: 1,
            maxWidth: 760,
            margin: "0 auto",
            padding: "32px 16px 80px",
          }}
        >
          {/* Header */}
          <div
            style={{
              marginBottom: 32,
              paddingBottom: 16,
              borderBottom: `1px solid ${C.border}`,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 12,
                marginBottom: 6,
              }}
            >
              <span
                style={{
                  fontFamily: C.display,
                  fontSize: 22,
                  fontWeight: 700,
                  color: C.cyan,
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                }}
              >
                Node Defenders
              </span>
              <span
                style={{
                  fontFamily: C.display,
                  fontSize: 13,
                  color: C.muted,
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                }}
              >
                API Harness
              </span>
              <span
                style={{
                  marginLeft: "auto",
                  fontFamily: C.mono,
                  fontSize: 9,
                  color: C.dim,
                  border: `1px solid ${C.dim}`,
                  borderRadius: 3,
                  padding: "2px 6px",
                  letterSpacing: "0.1em",
                }}
              >
                DEV ONLY
              </span>
            </div>
            <p
              style={{
                color: C.muted,
                fontSize: 10,
                fontFamily: C.mono,
                lineHeight: 1.7,
              }}
            >
              Real calls to{" "}
              <code style={{ color: C.cyan }}>
                {process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}
              </code>{" "}
              · Open dev console with{" "}
              <kbd
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: `1px solid ${C.border}`,
                  borderRadius: 3,
                  padding: "1px 5px",
                  fontSize: 9,
                  color: C.text,
                }}
              >
                Ctrl+Shift+D
              </kbd>
            </p>
          </div>

          {/* Sections */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <PlayerSection refreshTrigger={purchaseCount} />
            <AuthSection />
            <SessionSection />
            <SoulSection />
            <LeaderboardSection />
            <MarketplaceSection />
            <BridgeSection />
          </div>
        </div>
      </div>

      <DevConsole />
    </>
  );
}
