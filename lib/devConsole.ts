/**
 * Beta Dev Console — event bus and log store
 * All writes are no-ops when NEXT_PUBLIC_DEV_MODE is not "true"
 */

export type LogDirection =
  | "API_OUT"
  | "API_IN"
  | "BRIDGE_IN"
  | "BRIDGE_OUT"
  | "AUTH"
  | "ERROR"
  | "INFO";

export interface LogEntry {
  id: string;
  timestamp: number;
  direction: LogDirection;
  label: string;
  payload?: unknown;
  status?: number;
  durationMs?: number;
  error?: string;
}

type Listener = (entries: LogEntry[]) => void;

class DevConsoleStore {
  private entries: LogEntry[] = [];
  private listeners: Set<Listener> = new Set();
  private enabled: boolean = false;

  init() {
    this.enabled =
      typeof window !== "undefined" &&
      process.env.NEXT_PUBLIC_DEV_MODE === "true";
  }

  isEnabled() {
    return this.enabled;
  }

  log(
    direction: LogDirection,
    label: string,
    payload?: unknown,
    meta?: { status?: number; durationMs?: number; error?: string },
  ) {
    if (!this.enabled) return;

    const entry: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      direction,
      label,
      payload,
      ...meta,
    };

    // Keep last 200 entries
    this.entries = [entry, ...this.entries].slice(0, 200);
    this.notify();
  }

  getEntries() {
    return this.entries;
  }

  clear() {
    this.entries = [];
    this.notify();
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((l) => l(this.entries));
  }
}

export const devConsole = new DevConsoleStore();
