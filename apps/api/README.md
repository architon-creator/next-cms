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
    cart.routes.ts        Maps HTTP verbs/paths to cart controller functions.
    flight.routes.ts      Maps HTTP verbs/paths to flight controller functions.
  controllers/
    cart.controller.ts    Cart request handlers (in-memory store today).
    flight.controller.ts  Flight search/booking request handlers (in-memory catalog today).
  types/
    cart.ts, flight.ts    Shared request/response shapes for each domain.
```

Each domain (cart, flights, and whatever comes next — payments, users, ...)
gets its own `routes/*.routes.ts` + `controllers/*.controller.ts` pair,
mounted in `app.ts`.

**In-memory data is a placeholder.** `cart.controller.ts` and
`flight.controller.ts` keep state in a module-level variable that resets on
every restart and isn't scoped per user/session. Swap in a real datastore
(and session/auth handling) before this is used for anything real.

## Endpoints

| Method | Path                | Description                                            |
| ------ | ------------------- | ------------------------------------------------------ |
| GET    | `/health`           | Liveness check.                                        |
| GET    | `/cart`             | Get the current cart.                                  |
| POST   | `/cart/items`       | Add an item (`id`, `name`, `price`, `quantity?`).      |
| DELETE | `/cart/items/:id`   | Remove one item from the cart.                         |
| DELETE | `/cart`             | Empty the cart.                                        |
| GET    | `/flights`          | Search flights (`?origin=&destination=`).              |
| GET    | `/flights/:id`      | Get one flight.                                        |
| POST   | `/flights/bookings` | Book a flight (`flightId`, `passengerName`, `seats?`). |
| GET    | `/flights/bookings` | List all bookings.                                     |

## Running locally

```bash
pnpm --filter api run dev     # tsx watch mode, http://localhost:4000
pnpm --filter api run build   # compiles src/ -> dist/
pnpm --filter api run start   # runs the compiled build
pnpm --filter api run typecheck
```

Copy `.env.example` to `.env` to override `PORT`.
