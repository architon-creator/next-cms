# next-cms

A pnpm workspace with two runnable apps and two shared packages:

```
apps/
  frontend/   Next.js app (Prismic-powered content pages, /login, header/footer)
  api/        Express API (auth, cart, flights — all in-memory today)
packages/
  cms/        Prismic client, slices, and generated types — shared by frontend
  ui/         Shared React components (Button, Card, Input, ...)
```

`apps/frontend` and `apps/api` are independent processes on independent
ports. The frontend's own `/api/auth/*` route handlers proxy to the Express
API server-side — the browser never talks to the API directly (see
[apps/frontend/lib/session.ts](apps/frontend/lib/session.ts)) — so **both
need to be running** for sign-in to work, even though only the frontend has
a browser-facing UI.

## Prerequisites

- Node.js >= 22.13
- pnpm 11 (`corepack enable` will pick up the version pinned in
  [package.json](package.json)'s `packageManager` field)

## Setup

```bash
pnpm install
cp apps/frontend/.env.example apps/frontend/.env.local
cp apps/api/.env.example apps/api/.env
```

`apps/frontend/.env.local` only needs changes if you have a private Prismic
repository (`PRISMIC_ACCESS_TOKEN`) or want to point `API_URL` somewhere
other than `http://localhost:4000`. `apps/api/.env` works unmodified for
local development; see [apps/api/.env.example](apps/api/.env.example) for
what each variable does and which ones are required in production.

## Running both apps

Start each in its own terminal, from the repo root:

```bash
# Terminal 1 — Express API, http://localhost:4000
pnpm api:dev

# Terminal 2 — Next.js app, http://localhost:3000
pnpm dev
```

Then open http://localhost:3000. Sign in at `/login` with the seeded demo
account (`demo@example.com` / `password123`, overridable via
`DEMO_USER_EMAIL`/`DEMO_USER_PASSWORD` in `apps/api/.env`) — the header
shows who's signed in and lets you sign out again.

Everything below runs from the repo root and delegates to the right
workspace package; see the per-app READMEs for direct
(`pnpm --filter <name> run ...`) equivalents and more detail.

| Command                             | Runs                                                 |
| ----------------------------------- | ---------------------------------------------------- |
| `pnpm dev`                          | Frontend dev server (`apps/frontend`, port 3000)     |
| `pnpm api:dev`                      | API dev server, with reload (`apps/api`, port 4000)  |
| `pnpm build`                        | Frontend production build                            |
| `pnpm api:build`                    | Compiles the API's TypeScript to `apps/api/dist`     |
| `pnpm start`                        | Runs the frontend's production build (after `build`) |
| `pnpm test` / `pnpm test:coverage`  | Frontend unit tests                                  |
| `pnpm typecheck`                    | Frontend typecheck                                   |
| `pnpm lint`                         | Lint (repo-wide)                                     |
| `pnpm format` / `pnpm format:check` | Prettier                                             |

To run the API's own build/typecheck directly rather than through a root
alias: `pnpm --filter api run <script>` (see
[apps/api/README.md](apps/api/README.md)).

## Learn more

- [apps/api/README.md](apps/api/README.md) — API structure and endpoint reference.
- [docs/prismic-mcp.md](docs/prismic-mcp.md) — Prismic MCP server setup.
- [docs/FAQ/](docs/FAQ/) — background on the ported FAQ slice system.
