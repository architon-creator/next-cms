# api

A standalone Node.js/Express backend, scaffolded with a basic
routes → controller structure so shopping-cart and flight-booking
features have somewhere to grow into. It's independent of the Next.js
app at the repo root — run it as its own process, on its own port.

## Structure

```
src/
  server.ts               Process entry point — loads .env, starts the HTTP server.
  app.ts                  Express app setup: middleware, route mounting, error handling.
  routes/
    auth.routes.ts        Maps HTTP verbs/paths to auth controller functions.
    cart.routes.ts        Maps HTTP verbs/paths to cart controller functions.
    flight.routes.ts      Maps HTTP verbs/paths to flight controller functions.
  controllers/
    auth.controller.ts    Login/logout/me request handlers.
    cart.controller.ts    Cart request handlers (in-memory store today).
    flight.controller.ts  Flight search/booking request handlers (in-memory catalog today).
  middleware/
    require-auth.ts       Verifies a bearer token, attaches req.session, or 401s.
  lib/
    users.ts               In-memory user directory + bcrypt credential checks.
    tokens.ts               Signs/verifies session JWTs.
  types/
    auth.ts, cart.ts, flight.ts   Shared request/response shapes for each domain.
```

Each domain (cart, flights, and whatever comes next — payments, users, ...)
gets its own `routes/*.routes.ts` + `controllers/*.controller.ts` pair,
mounted in `app.ts`.

**In-memory data is a placeholder.** `cart.controller.ts` and
`flight.controller.ts` keep state in a module-level variable that resets on
every restart and isn't scoped per user/session. Swap in a real datastore
(and session/auth handling) before this is used for anything real.

**Auth is also a placeholder.** `lib/users.ts` keeps a single seeded user in
a module-level array, and `POST /auth/login` returns a self-contained JWT —
there's no revocation, refresh, or persistence, so a restart forgets nothing
but also enforces nothing beyond the token's own expiry. Swap in a real user
store (and, if you need revocation, a server-side session table) before this
is used for anything real.

## Endpoints

| Method | Path                | Description                                                      |
| ------ | ------------------- | ---------------------------------------------------------------- |
| GET    | `/health`           | Liveness check.                                                  |
| POST   | `/auth/login`       | Exchange `email`/`password` for a session token.                 |
| POST   | `/auth/logout`      | No-op (tokens are stateless) — returns `204`.                    |
| GET    | `/auth/me`          | The caller's own user. Requires `Authorization: Bearer <token>`. |
| GET    | `/cart`             | Get the current cart.                                            |
| POST   | `/cart/items`       | Add an item (`id`, `name`, `price`, `quantity?`).                |
| DELETE | `/cart/items/:id`   | Remove one item from the cart.                                   |
| DELETE | `/cart`             | Empty the cart.                                                  |
| GET    | `/flights`          | Search flights (`?origin=&destination=`).                        |
| GET    | `/flights/:id`      | Get one flight.                                                  |
| POST   | `/flights/bookings` | Book a flight (`flightId`, `passengerName`, `seats?`).           |
| GET    | `/flights/bookings` | List all bookings.                                               |

## Running locally

```bash
pnpm --filter api run dev     # tsx watch mode, http://localhost:4000
pnpm --filter api run build   # compiles src/ -> dist/
pnpm --filter api run start   # runs the compiled build
pnpm --filter api run typecheck
```

Copy `.env.example` to `.env` — the defaults work for local development.
`JWT_SECRET` and `DEMO_USER_PASSWORD` must both be overridden before
`NODE_ENV=production`; the app throws at startup otherwise rather than
running with a publicly-known secret. See `.env.example` for what each
variable does.

This app has no browser UI of its own — see the repo root
[README](../../README.md) for running it together with `apps/frontend`,
which is what actually exercises `/auth/login`.
