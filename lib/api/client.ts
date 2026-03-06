/**
 * lib/api/client.ts
 *
 * Base fetch wrapper for node-defenders-api (NestJS on Render).
 * - Reads JWT from authStore on every request (always fresh)
 * - Emits to devConsole when DEV_MODE is enabled
 * - Throws ApiError with status + message on non-2xx
 * - Dispatches "auth:expired" custom event on 401 so authStore can react
 */

import { devConsole } from "@/lib/devConsole";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** Skip JWT header — used for /auth endpoints */
  public?: boolean;
};

/**
 * Lazily read JWT to avoid circular dependency with authStore.
 * authStore writes to localStorage; we read from there directly.
 */
function getStoredJwt(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("nd_auth");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.state?.jwt ?? null;
  } catch {
    return null;
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = "GET", body, public: isPublic = false } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (!isPublic) {
    const jwt = getStoredJwt();
    if (jwt) headers["Authorization"] = `Bearer ${jwt}`;
  }

  const url = `${API_BASE}${path}`;
  const label = `${method} ${path}`;
  const startMs = Date.now();

  devConsole.log("API_OUT", label, body ?? null);

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (networkErr) {
    const msg =
      networkErr instanceof Error ? networkErr.message : "Network error";
    devConsole.log("ERROR", label, null, { error: msg });
    throw new ApiError(0, msg);
  }

  const durationMs = Date.now() - startMs;
  let responseBody: unknown;

  try {
    responseBody = await response.json();
  } catch {
    responseBody = null;
  }

  if (!response.ok) {
    const message =
      (responseBody as any)?.message ?? response.statusText ?? "Request failed";

    devConsole.log("ERROR", label, responseBody, {
      status: response.status,
      durationMs,
      error: message,
    });

    if (response.status === 401) {
      window.dispatchEvent(new CustomEvent("auth:expired"));
    }

    throw new ApiError(response.status, message, responseBody);
  }

  devConsole.log("API_IN", label, responseBody, {
    status: response.status,
    durationMs,
  });

  return responseBody as T;
}
