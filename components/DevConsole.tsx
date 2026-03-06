"use client";

/**
 * components/DevConsole.tsx
 *
 * Floating beta dev console. Only rendered when NEXT_PUBLIC_DEV_MODE=true.
 * Toggle: Ctrl+Shift+D or the persistent tab on the right edge.
 *
 * Shows a live feed of API calls, bridge events, auth changes, errors.
 * Cyberpunk aesthetic — dark panel, monospace, color-coded badges.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { devConsole, type LogEntry, type LogDirection } from "@/lib/devConsole";

// ── Badge config ──────────────────────────────────────────────────────────────

const BADGE: Record<
  LogDirection,
  { label: string; color: string; bg: string }
> = {
  API_OUT: { label: "API →", color: "#00d4ff", bg: "rgba(0,212,255,0.12)" },
  API_IN: { label: "API ←", color: "#00ff88", bg: "rgba(0,255,136,0.12)" },
  BRIDGE_IN: { label: "UNITY →", color: "#ffd700", bg: "rgba(255,215,0,0.12)" },
  BRIDGE_OUT: {
    label: "→ UNITY",
    color: "#ff8c00",
    bg: "rgba(255,140,0,0.12)",
  },
  AUTH: { label: "AUTH", color: "#c084fc", bg: "rgba(192,132,252,0.12)" },
  ERROR: { label: "ERROR", color: "#ff4444", bg: "rgba(255,68,68,0.15)" },
  INFO: { label: "INFO", color: "#94a3b8", bg: "rgba(148,163,184,0.10)" },
};

// ── Sub-components ────────────────────────────────────────────────────────────

function Badge({ direction }: { direction: LogDirection }) {
  const cfg = BADGE[direction];
  return (
    <span
      style={{
        color: cfg.color,
        background: cfg.bg,
        border: `1px solid ${cfg.color}33`,
        borderRadius: 3,
        padding: "1px 5px",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.05em",
        fontFamily: "monospace",
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      {cfg.label}
    </span>
  );
}

function EntryRow({ entry }: { entry: LogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = BADGE[entry.direction];
  const time = new Date(entry.timestamp).toLocaleTimeString("en-GB", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const ms = `${new Date(entry.timestamp).getMilliseconds()}`.padStart(3, "0");

  const hasPayload = entry.payload !== null && entry.payload !== undefined;

  return (
    <div
      style={{
        borderBottom: "1px solid rgba(255,255,255,0.04)",
        padding: "5px 8px",
        cursor: hasPayload ? "pointer" : "default",
        background: expanded ? "rgba(255,255,255,0.03)" : "transparent",
        transition: "background 0.1s",
      }}
      onClick={() => hasPayload && setExpanded((e) => !e)}
    >
      {/* Row header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            color: "#475569",
            fontSize: 10,
            fontFamily: "monospace",
            whiteSpace: "nowrap",
          }}
        >
          {time}
          <span style={{ color: "#334155" }}>.{ms}</span>
        </span>
        <Badge direction={entry.direction} />
        <span
          style={{
            color: "#e2e8f0",
            fontSize: 11,
            fontFamily: "monospace",
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {entry.label}
        </span>
        <div
          style={{
            display: "flex",
            gap: 4,
            alignItems: "center",
            flexShrink: 0,
          }}
        >
          {entry.status !== undefined && (
            <span
              style={{
                fontSize: 10,
                color:
                  entry.status >= 400
                    ? "#ff4444"
                    : entry.status >= 200
                      ? "#00ff88"
                      : "#94a3b8",
                fontFamily: "monospace",
              }}
            >
              {entry.status}
            </span>
          )}
          {entry.durationMs !== undefined && (
            <span
              style={{
                fontSize: 10,
                color: "#475569",
                fontFamily: "monospace",
              }}
            >
              {entry.durationMs}ms
            </span>
          )}
          {entry.error && (
            <span
              style={{
                fontSize: 10,
                color: "#ff4444",
                fontFamily: "monospace",
                maxWidth: 120,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {entry.error}
            </span>
          )}
          {hasPayload && (
            <span style={{ color: "#334155", fontSize: 10 }}>
              {expanded ? "▲" : "▼"}
            </span>
          )}
        </div>
      </div>

      {/* Expanded payload */}
      {expanded && hasPayload && (
        <pre
          style={{
            margin: "6px 0 2px 0",
            padding: "6px 8px",
            background: "rgba(0,0,0,0.4)",
            borderRadius: 4,
            fontSize: 10,
            color: cfg.color,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            overflowX: "auto",
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
            maxHeight: 200,
            overflowY: "auto",
            border: `1px solid ${cfg.color}22`,
          }}
        >
          {JSON.stringify(entry.payload, null, 2)}
        </pre>
      )}
    </div>
  );
}

// ── Mock event buttons ────────────────────────────────────────────────────────

function MockButtons() {
  const fire = (type: string, data: unknown) => {
    window.dispatchEvent(new CustomEvent(`nd:${type}`, { detail: data }));
  };

  const buttons: Array<{ label: string; action: () => void; color: string }> = [
    {
      label: "▶ gameplay_submission",
      color: "#ffd700",
      action: () =>
        fire("gameplay_submission", {
          total_score: 1500,
          total_levels_completed: 3,
          total_playtime_seconds: 120,
          enemies_killed: 42,
          rounds_survived: 3,
        }),
    },
    {
      label: "🛒 marketplace_open",
      color: "#00d4ff",
      action: () => fire("marketplace_open", { soulBalance: "500" }),
    },
    {
      label: "💰 marketplace_buy",
      color: "#00ff88",
      action: () =>
        fire("marketplace_buy", { typeId: 1, paymentToken: "SOUL" }),
    },
    {
      label: "⏱ marketplace_rent",
      color: "#ff8c00",
      action: () =>
        fire("marketplace_rent", {
          typeId: 2,
          tierId: 1,
          paymentToken: "SOUL",
        }),
    },
  ];

  return (
    <div
      style={{
        padding: "8px",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        display: "flex",
        flexWrap: "wrap",
        gap: 4,
      }}
    >
      <div
        style={{
          width: "100%",
          fontSize: 9,
          color: "#475569",
          fontFamily: "monospace",
          marginBottom: 3,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
        }}
      >
        Mock Unity Events
      </div>
      {buttons.map((b) => (
        <button
          key={b.label}
          onClick={b.action}
          style={{
            background: "transparent",
            border: `1px solid ${b.color}44`,
            color: b.color,
            borderRadius: 3,
            padding: "3px 7px",
            fontSize: 10,
            fontFamily: "monospace",
            cursor: "pointer",
            transition: "background 0.1s",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = `${b.color}18`)
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = "transparent")
          }
        >
          {b.label}
        </button>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DevConsole() {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<LogDirection | "ALL">("ALL");
  const [paused, setPaused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  pausedRef.current = paused;

  // Init devConsole on mount
  useEffect(() => {
    devConsole.init();
    const unsub = devConsole.subscribe((e) => {
      if (!pausedRef.current) setEntries([...e]);
    });
    setEntries(devConsole.getEntries());
    return () => {
      unsub();
    };
  }, []);

  // Keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "D") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const filtered =
    filter === "ALL" ? entries : entries.filter((e) => e.direction === filter);

  const FILTERS: Array<LogDirection | "ALL"> = [
    "ALL",
    "API_OUT",
    "API_IN",
    "BRIDGE_IN",
    "BRIDGE_OUT",
    "AUTH",
    "ERROR",
  ];

  if (process.env.NEXT_PUBLIC_DEV_MODE !== "true") return null;

  return (
    <>
      {/* Persistent tab */}
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          position: "fixed",
          right: open ? 440 : 0,
          top: "50%",
          transform: "translateY(-50%) rotate(0deg)",
          zIndex: 9999,
          background: "rgba(10,14,20,0.95)",
          border: "1px solid rgba(0,212,255,0.3)",
          borderRight: open ? "1px solid rgba(0,212,255,0.3)" : "none",
          color: "#00d4ff",
          padding: "12px 6px",
          borderRadius: open ? "6px 0 0 6px" : "6px 0 0 6px",
          cursor: "pointer",
          fontSize: 10,
          fontFamily: "monospace",
          letterSpacing: "0.12em",
          writingMode: "vertical-rl",
          transition: "right 0.25s cubic-bezier(0.4,0,0.2,1)",
          boxShadow: "-2px 0 12px rgba(0,212,255,0.08)",
        }}
        title="Toggle Dev Console (Ctrl+Shift+D)"
      >
        {open ? "CLOSE" : "DEV"}
      </button>

      {/* Panel */}
      <div
        style={{
          position: "fixed",
          right: open ? 0 : -440,
          top: 0,
          bottom: 0,
          width: 440,
          zIndex: 9998,
          background: "rgba(8,12,18,0.97)",
          borderLeft: "1px solid rgba(0,212,255,0.15)",
          display: "flex",
          flexDirection: "column",
          transition: "right 0.25s cubic-bezier(0.4,0,0.2,1)",
          boxShadow: "-4px 0 32px rgba(0,0,0,0.6)",
          backdropFilter: "blur(12px)",
          fontFamily: "monospace",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "10px 12px 8px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            background: "rgba(0,212,255,0.04)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            <div>
              <span
                style={{
                  color: "#00d4ff",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.15em",
                }}
              >
                ◈ NODE DEFENDERS
              </span>
              <span style={{ color: "#334155", fontSize: 11, marginLeft: 6 }}>
                DEV CONSOLE
              </span>
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span style={{ color: "#334155", fontSize: 9 }}>
                {filtered.length} entries
              </span>
              <button
                onClick={() => setPaused((p) => !p)}
                style={{
                  background: paused ? "rgba(255,200,0,0.15)" : "transparent",
                  border: `1px solid ${paused ? "#ffc800" : "rgba(255,255,255,0.1)"}`,
                  color: paused ? "#ffc800" : "#64748b",
                  borderRadius: 3,
                  padding: "2px 6px",
                  fontSize: 9,
                  cursor: "pointer",
                  fontFamily: "monospace",
                }}
              >
                {paused ? "⏸ PAUSED" : "⏺ LIVE"}
              </button>
              <button
                onClick={() => {
                  devConsole.clear();
                  setEntries([]);
                }}
                style={{
                  background: "transparent",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "#64748b",
                  borderRadius: 3,
                  padding: "2px 6px",
                  fontSize: 9,
                  cursor: "pointer",
                  fontFamily: "monospace",
                }}
              >
                CLEAR
              </button>
            </div>
          </div>

          {/* Filter pills */}
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {FILTERS.map((f) => {
              const cfg = f === "ALL" ? null : BADGE[f];
              const isActive = filter === f;
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  style={{
                    background: isActive
                      ? cfg
                        ? cfg.bg
                        : "rgba(255,255,255,0.1)"
                      : "transparent",
                    border: `1px solid ${isActive ? (cfg?.color ?? "#fff") + "66" : "rgba(255,255,255,0.08)"}`,
                    color: isActive ? (cfg?.color ?? "#e2e8f0") : "#475569",
                    borderRadius: 3,
                    padding: "2px 7px",
                    fontSize: 9,
                    cursor: "pointer",
                    fontFamily: "monospace",
                    letterSpacing: "0.06em",
                    transition: "all 0.1s",
                  }}
                >
                  {f === "ALL" ? "ALL" : BADGE[f].label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Log entries */}
        <div
          ref={scrollRef}
          style={{
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
            scrollbarWidth: "thin",
            scrollbarColor: "rgba(0,212,255,0.2) transparent",
          }}
        >
          {filtered.length === 0 ? (
            <div
              style={{
                padding: 24,
                textAlign: "center",
                color: "#1e293b",
                fontSize: 11,
                fontFamily: "monospace",
              }}
            >
              No entries yet.{" "}
              {filter !== "ALL" && (
                <span
                  style={{ color: "#00d4ff", cursor: "pointer" }}
                  onClick={() => setFilter("ALL")}
                >
                  Clear filter
                </span>
              )}
            </div>
          ) : (
            filtered.map((entry) => <EntryRow key={entry.id} entry={entry} />)
          )}
        </div>

        {/* Mock buttons */}
        <MockButtons />

        {/* Footer */}
        <div
          style={{
            padding: "5px 10px",
            borderTop: "1px solid rgba(255,255,255,0.04)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span
            style={{ color: "#1e293b", fontSize: 9, fontFamily: "monospace" }}
          >
            CTRL+SHIFT+D to toggle
          </span>
          <span
            style={{ color: "#1e293b", fontSize: 9, fontFamily: "monospace" }}
          >
            NEXT_PUBLIC_DEV_MODE=true
          </span>
        </div>
      </div>
    </>
  );
}
