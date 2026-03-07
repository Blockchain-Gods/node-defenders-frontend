# node-defenders-frontend

Next.js frontend shell for [Node Defenders](https://defenders.blockchaingods.io) — the first title in the [Blockchain Gods](https://blockchaingods.io) Web3 gaming universe.

This repo is the **public-facing web layer**. It authenticates players, manages the game session lifecycle, and communicates with the Unity WebGL build via a typed JS bridge. The Unity game itself (artwork, C# code, WebGL build) lives in a separate private repo and is served from Cloudflare R2 — this repo is designed to run with or without Unity mounted.

---

## What this is (and isn't)

**This repo handles:**

- Guest auth — every player gets a custodial wallet silently on first visit, no wallet connection required
- JWT lifecycle (storage, expiry checks, renewal)
- API communication with `node-defenders-api` (sessions, SOUL balance, leaderboard, marketplace)
- Marketplace metadata resolution — fetches and merges R2 JSON before sending to Unity
- Unity ↔ JS bridge (typed event contract for game ↔ backend communication)
- Beta dev console and API harness for testing without Unity

**This repo does not contain:**

- The Unity WebGL build — served from Cloudflare R2 via `cdn.blockchaingods.io`
- Game artwork, C# source, or Unity project files
- Private keys, wallet signing logic — handled by `node-defenders-signer`

---

## Architecture

```
Browser
  │
  │  Next.js shell (this repo)
  ├── Auth: guest → JWT (custodial wallet provisioned silently)
  ├── Marketplace: fetch listings → resolve R2 metadata → send to Unity
  ├── Bridge: postMessage ↔ CustomEvent (Unity ↔ JS)
  ├── API client: JWT-authenticated fetch → node-defenders-api
  │
  │  Unity WebGL (separate private repo)
  └── Served from cdn.blockchaingods.io — loaded by UnityGamePlayer.tsx
```

### Unity integration

The Unity build is **not bundled here**. `UnityGamePlayer.tsx` loads the build from `/unity-build` at runtime, pointed at:

- `cdn.blockchaingods.io/unity-build/` in production (Cloudflare R2)
- A local symlink / copy of the Unity WebGL output during development

The bridge contract (what Unity sends, what JS sends back) is defined in `lib/bridge/types.ts`. Unity receives display-ready data — the FE resolves all metadata before sending anything to Unity.

---

## Tech stack

- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **State**: Zustand with localStorage persistence
- **Styling**: Tailwind CSS
- **Hosting**: Cloudflare Pages

---

## Project structure

```
app/
  page.tsx              # Game shell — mounts Unity, wires bridge
  dev/
    page.tsx            # API harness (dev only, blocked in production)

components/
  UnityGamePlayer.tsx   # Unity WebGL canvas loader
  DevConsole.tsx        # Floating dev console overlay

lib/
  api/
    client.ts           # Base fetch wrapper, JWT injection, 401 handling
    auth.ts             # POST /auth/guest
    session.ts          # POST /sessions/start|earn|end
    soul.ts             # GET /soul/balance
    leaderboard.ts      # GET + POST /leaderboard
    marketplace.ts      # GET listings (with R2 metadata resolution), POST buy/rent
  bridge/
    types.ts            # Typed Unity ↔ JS event contract
    receiver.ts         # postMessage listener → typed CustomEvents
    sender.ts           # SendMessage wrapper → Unity
  hooks/
    useAuth.ts          # Auth init, token renewal
    useGameSession.ts   # Session lifecycle, beforeunload cleanup
    useMarketplace.ts   # Listings, buy, rent
    useUnityBridge.ts   # Central wiring: bridge → hooks → bridge
  store/
    authStore.ts        # Zustand: jwt, playerId, wallet, authMethod
  devConsole.ts         # Dev log store (no-op in production)
```

---

## Setup

### Prerequisites

- Node.js 18+
- `node-defenders-api` running locally (see its README)

### Install

```bash
npm install
```

### Environment variables

```bash
cp .env.example .env.local
```

| Variable                       | Description                                                 |
| ------------------------------ | ----------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL`          | NestJS API base URL — `http://localhost:3001` for local dev |
| `NEXT_PUBLIC_GAME_ID`          | Node Defenders game ID (default: `1`)                       |
| `NEXT_PUBLIC_SURVIVAL_MODE_ID` | Survival mode ID (default: `1`)                             |
| `NEXT_PUBLIC_DEV_MODE`         | Set to `true` to enable dev console + `/dev` harness        |

### Run

```bash
npm run dev
```

### Unity build (optional)

To run with the actual game, place or symlink the Unity WebGL output at `public/unity-build/`. Expected structure:

```
public/
  unity-build/
    Build/
      build.loader.js
      build.data.unityweb
      build.framework.js.unityweb
      build.wasm.unityweb
    StreamingAssets/
```

Without this, the shell loads but the Unity canvas stays blank. All API flows still work via the dev harness at `/dev`.

---

## Auth flow

```
App mount
  → check localStorage (nd_auth) for stored JWT
  → JWT valid + > 2 days remaining → use it
  → JWT expiring or absent → POST /auth/guest
      → API creates player record + custodial wallet (via signer)
      → returns 30-day JWT + wallet address
  → store jwt, playerId, wallet
  → Unity instance ready → send OnAuthReady { wallet, soulBalance, playerId }
```

No wallet connection required. Every player gets a custodial wallet silently. Wallet upgrade path (Web3Auth, SIWE) is implemented in `useAuth.ts` but not exposed in the UI for the current release.

---

## Asset CDN

Upgrade metadata and images are served from Cloudflare R2 via `cdn.blockchaingods.io`.

```
cdn.blockchaingods.io/
  upgrades/
    basic-rounds.json       # ERC-721 metadata
    basic-rounds.png
    solar-lance.json
    solar-lance.png
    arc-striker.json
    arc-striker.png
```

**Metadata resolution happens in the FE**, not in Unity. `getListings()` in `lib/api/marketplace.ts` fetches each item's `metadataURI` from R2, merges the result with the listing data, and sends Unity a flat display-ready object. Unity never sees raw `metadataURI` strings.

**Hidden type IDs:** typeIds 1 and 2 are placeholder seeds registered on-chain during initial contract deployment. They are filtered out client-side in `marketplace.ts` via `HIDDEN_TYPE_IDS` and are never sent to Unity or shown to players.

**Default item:** Basic Rounds (typeId 3) is granted to every new player automatically by the API on account creation. It appears in the marketplace as "OWNED".

---

## Unity bridge contract

All Unity ↔ JS communication is typed in `lib/bridge/types.ts`.

### Unity → JS (postMessage from GameInterop.jslib)

| Event                 | Payload                            | Triggers                                       |
| --------------------- | ---------------------------------- | ---------------------------------------------- |
| `gameplay_submission` | analytics object                   | `sessions/end`                                 |
| `marketplace_open`    | `{ soulBalance }`                  | fetch + resolve listings → `OnMarketplaceData` |
| `marketplace_buy`     | `{ typeId, paymentToken }`         | `marketplace/buy` → `OnPurchaseResult`         |
| `marketplace_rent`    | `{ typeId, tierId, paymentToken }` | `marketplace/rent` → `OnPurchaseResult`        |

### JS → Unity (SendMessage to GameManager)

| Method              | Payload                             | When sent                                         |
| ------------------- | ----------------------------------- | ------------------------------------------------- |
| `OnAuthReady`       | `{ wallet, soulBalance, playerId }` | Auth complete, after session end                  |
| `OnSessionStarted`  | `{ sessionId }`                     | After `sessions/start`                            |
| `OnMarketplaceData` | `{ listings[] }`                    | Listings resolved, response to `marketplace_open` |
| `OnPurchaseResult`  | `{ success, error?, txHash? }`      | After buy/rent completes                          |

`OnMarketplaceData` listings are pre-resolved — each item includes `name`, `description`, `image`, `rarity`, `buyPriceSoul`, `buyPriceGods`, and `attributes` ready for Unity to render directly.

---

## Dev tools

### Dev console

A floating overlay showing all API calls and bridge events in real time.

- Toggle: `Ctrl+Shift+D` or the persistent tab on the right edge
- Color-coded by direction: API in/out, bridge in/out, auth, errors
- Click any entry to expand the full payload
- Only active when `NEXT_PUBLIC_DEV_MODE=true`

### API harness (`/dev`)

A full test UI for every API endpoint — no Unity required.

- Auth: guest login, view stored JWT, clear session
- Session: start, earn, end with editable amounts
- Soul: balance fetch
- Leaderboard: fetch + mock submit
- Marketplace: listings (with metadata resolved), buy, rent with token selector
- Bridge mock: fire Unity events from buttons, see them arrive in real time

Blocked in production (`NEXT_PUBLIC_DEV_MODE !== "true"` redirects to `/`).

---

## Related repos

- [node-defenders-contracts](https://github.com/Blockchain-Gods/node-defenders-contracts) — Solidity contracts + deploy scripts
- [node-defenders-api](https://github.com/Blockchain-Gods/node-defenders-api) — NestJS game API
- [node-defenders-signer](https://github.com/Blockchain-Gods/node-defenders-signer) — Isolated signing service
- Unity project repo — WebGL build source (private)
