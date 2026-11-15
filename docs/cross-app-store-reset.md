# Clearing the store of two Next.js apps from one button

**The question:** two Next.js apps live in one monorepo and both keep state in a store.
When the user clicks **Search** in app 1, *every* store value must be cleared, including
app 2's slices.

This doc explains why that is harder than it sounds, the options, and what we recommend.

---

## 1. Glossary (plain words)

| Term | What it means here |
|---|---|
| **Store** | The in-memory object (Redux) holding app state. Lives in the browser tab's JavaScript memory. |
| **Slice** | One section of the store (`formData`, `confirmations`, `progress`). |
| **Persist** | redux-persist copies the store into `localStorage` so a page refresh doesn't lose it. In this repo the key is `persist:next-cms-stepper`. |
| **Origin** | Protocol + domain + port, e.g. `https://app1.example.com`. Browsers give each origin its **own** `localStorage`. |
| **Epoch** | A "version number of the current user journey". We bump it on Search; any state saved under an older epoch is thrown away. |
| **BroadcastChannel** | A browser feature that lets tabs/apps on the **same origin** send each other messages. |

---

## 2. Why one app can't just "clear the other app's store"

Think of each app as a separate office with its own filing cabinet.

1. **Each app has its own in-memory store.** App 1 and App 2 are two separate bundles. Even
   on the same page they do not share JavaScript objects. App 1 simply cannot reach into
   App 2's memory.
2. **The only shared thing is the browser's storage**, and only if both apps are on the
   **same origin**. Different domain or port = different `localStorage`; App 1 can't even
   see App 2's saved data.
3. **Deleting the saved copy doesn't clear a live store.** If App 2 is open in another tab,
   removing `localStorage` does nothing to the state already in its memory. It will even
   write the old state back on its next change.

So "clear everything" really means doing **three** different things.

---

## 3. What goes wrong without each piece (scenarios)

| Piece | Scenario if we skip it |
|---|---|
| Reset App 1's own store | User searches, but the old form data is still in the next step. |
| Purge App 1's saved copy | User refreshes the page → old data comes back from `localStorage`. |
| Tell App 2 (live) | App 2 is open in another tab, still showing the old booking. |
| Epoch check on App 2's startup | App 2 was closed when the user searched; later it opens and happily loads stale saved data. |

---

## 4. The options

| Option | Works when | Clears live App 2? | Clears closed App 2? | Effort |
|---|---|---|---|---|
| **A. Shared reset action + purge own storage** | Only one app | n/a | n/a | tiny |
| **B. + BroadcastChannel** | Same origin | Yes (any tab) | No | small |
| **C. + Epoch (version) check at startup** | Same origin, **or** a shared cookie on the parent domain | No (needs B) | Yes | small |
| **D. Server-side state / session** | Different origins, no shared parent domain | via refresh/poll | Yes | large |

**Recommendation: B + C together** when both apps share an origin or parent domain.
B handles apps that are open right now; C handles apps that were closed. If the apps
are on unrelated domains, only D (or a redirect handshake) works. A browser will not let
one origin touch another's storage.

---

## 5. Recommended design

> **Update (same-origin deployment, e.g. `ab.com/en` and `ab.com/booking/en`):** because both
> apps share one origin they also share `localStorage`, so app 1 can simply **delete app 2's
> saved copy directly**. The "epoch" version number below is therefore **not needed** for this
> setup; it is only useful when an app cannot reach the other app's saved copy. The working
> example in section 9 uses the simpler approach: reset own store, delete every registered
> saved copy, broadcast to open tabs.


Put the reset logic in **one shared package** (e.g. `packages/app-state`) so both apps
behave identically.

### The flow, in order

1. User clicks **Search** in App 1.
2. App 1 calls `resetEverything()` from the shared package.
3. `resetEverything()` does four things:
   1. Dispatches `resetAll` → App 1's reducer returns every slice to its initial state.
   2. Purges App 1's persisted copy.
   3. Bumps the epoch (a number in `localStorage`, or a cookie on the parent domain).
   4. Broadcasts `{ type: "reset", epoch }` on a `BroadcastChannel`.
4. Any **open** App 2 (same origin) receives the message and dispatches its own `resetAll`
   and purge.
5. Any **closed** App 2 later starts up, reads its saved state, sees the saved epoch is
   older than the current epoch, and drops the saved state before using it.

### Code sketch

Shared package:

```ts
// packages/app-state/src/index.ts
import { createAction, type Reducer, type UnknownAction } from "@reduxjs/toolkit";

export const resetAll = createAction("app/resetAll");

/** Wrap an app's root reducer so `resetAll` returns EVERY slice to its initial state. */
export function withResetAll<S>(reducer: Reducer<S>): Reducer<S> {
  return (state, action: UnknownAction) =>
    reducer(action.type === resetAll.type ? undefined : state, action);
}

const EPOCH_KEY = "app-state:epoch";
const CHANNEL = "app-state";

export const getEpoch = () => Number(localStorage.getItem(EPOCH_KEY) ?? 0);

/** Call from App 1's Search handler. `purge` = this app's persistor.purge. */
export function resetEverything(
  dispatch: (a: UnknownAction) => unknown,
  purge: () => Promise<unknown>,
) {
  dispatch(resetAll());
  void purge();
  const epoch = getEpoch() + 1;
  localStorage.setItem(EPOCH_KEY, String(epoch));
  new BroadcastChannel(CHANNEL).postMessage({ type: "reset", epoch });
}

/** Call once per app at startup, so open tabs/apps reset when told to. */
export function listenForReset(
  dispatch: (a: UnknownAction) => unknown,
  purge: () => Promise<unknown>,
) {
  const channel = new BroadcastChannel(CHANNEL);
  channel.onmessage = (event) => {
    if (event.data?.type === "reset") {
      dispatch(resetAll());
      void purge();
    }
  };
  return () => channel.close();
}
```

In each app's `persist-config.ts` (this repo's existing shape):

```ts
import { withResetAll, getEpoch } from "app-state";

const rootReducer = withResetAll(combineReducers({ formData, confirmations, progress }));

export const persistedReducer = persistReducer(
  {
    key: "next-cms-stepper",
    version: 1,
    storage,
    whitelist: ["formData", "confirmations", "progress"],
    // Closed-app case: drop saved state that is older than the current epoch.
    migrate: async (state) =>
      state && (state as { _epoch?: number })._epoch === getEpoch() ? state : undefined,
  },
  rootReducer,
);
```

(The saved state also needs to record `_epoch` when it is written, for example with a
`createTransform`, or by storing the epoch under the persist key next to the state.)

And the Search button, replacing today's per-slice `startNewFlow` dispatch for the
"clear everything" case:

```ts
resetEverything(dispatch, () => persistor.purge());
```

---

## 6. What happens when…

| Situation | Result |
|---|---|
| User searches, App 2 is **not open** | Epoch bumped. When App 2 opens later it sees an older saved epoch and starts empty. |
| User searches, App 2 is **open in another tab** | Gets the broadcast, resets live, purges its saved copy. |
| Search is clicked twice quickly | Two epoch bumps and two resets. Harmless: the reset is idempotent. |
| User has the apps on **different origins** | Broadcast and shared `localStorage` don't reach. Use a shared parent-domain cookie for the epoch, or server-side state (option D). |
| `BroadcastChannel` unsupported (very old browsers) | Fall back to the `storage` event on the epoch key, or rely on the epoch check at next load. |
| A slice should **survive** a search (e.g. user preferences) | Keep it out of the reset: reset only the listed slices instead of `undefined`, or keep it in a separate persisted store. |

---

## 7. Open questions to settle before building

1. ~~**Same origin or not?**~~ **Answered: same origin** (`ab.com/en`, `ab.com/booking/en`),
   so the approach in section 9 is enough and no server-side state is needed.
2. **Should *everything* clear,** including user-level things like language or sign-in
   state? Usually "journey state" should clear and "user settings" should not.
3. **Is the second app's store meant to be the same shape** (shared slices package) or
   independent? Independent stores just need to subscribe to `resetAll`.

---

## 8. Where to look in this repo

- Store and persistence today: `apps/frontend/store/store.ts`, `apps/frontend/store/persist-config.ts`
- Existing in-app reset: `startNewFlow` in `apps/frontend/store/slices/progress-slice.ts`, dispatched from `apps/frontend/components/search-section.tsx`
- `admin-app` has no store yet; it would be the second consumer.

---

## 9. Working example in this repo

**The rule it demonstrates:** clicking **Search** in app 1 must **keep the search form** but
**delete the booking app's previous data**. So Search does *not* reset everything; it clears
one named app: `clearApps([APP_KEYS.booking])`.

| Piece | Where |
|---|---|
| Shared logic (`clearApps`, `resetEverything`, `resetAll`, `resetSlices`, `withResetAll`, `listenForReset`, `APP_KEYS`) | `packages/app-state/src/index.ts` |
| Unit tests (7) | `packages/app-state/src/index.test.ts` |
| App 1 (search app): store wrapped with `withResetAll`, new `search` slice | `apps/frontend/store/persist-config.ts`, `store/slices/search-slice.ts` |
| App 1: listens for resets aimed at it | `apps/frontend/components/redux-provider.tsx` |
| App 1: demo page (route `/store-reset-demo`) | `apps/frontend/app/[locale]/store-reset-demo/` |
| App 2 (booking app): tiny Next app under `/booking`, own store | `apps/booking-app/` |
| Local stand-in for `ab.com/booking` (serves app 2 under app 1's origin) | `rewrites` in `apps/frontend/next.config.mjs` |

### How both apps load on one origin (the reverse proxy)

They are really **two servers**, but the browser only ever talks to one:

| Server | Port | Role |
|---|---|---|
| Frontend (app 1) | 3000 | what the browser talks to |
| Booking app (app 2) | 3001 | never opened directly |

```text
Browser ──► localhost:3000/booking/en
                │
                ▼
        Frontend (app 1, :3000)
        rewrite: /booking/:path*  ──►  http://localhost:3001/booking/:path*
                │                              │
                │ ◄──── page / JS / CSS ───────┘
                ▼
Browser shows the booking app; address bar still says :3000
```

1. The browser asks port 3000 for `/booking/en`.
2. App 1 has no such page, but the `rewrites` rule in `apps/frontend/next.config.mjs` forwards
   any `/booking...` path to `http://localhost:3001`.
3. App 1 fetches the page (and its scripts and styles) from port 3001 and returns it as its own response.
4. App 2's `basePath: "/booking"` makes all its files live under `/booking/_next/...`, so they never
   collide with app 1's own files.

**Why:** a browser's origin is protocol + domain + **port**. `:3000` and `:3001` are different origins
with separate `localStorage`, so one app could not see or delete the other's saved data. Through the
proxy both apps share the origin `localhost:3000`, which is exactly what `clearApps` relies on.

**In production** this is the platform's job (e.g. `ab.com/booking` routed to the booking app), so the
rewrite is dev-only: active when `NODE_ENV` is not `production`, or when `BOOKING_APP_URL` is set.

**Consequences**
- Both servers must be running; with app 2 stopped, `localhost:3000/booking` shows an error page.
- Always open the booking app through port **3000**. Opening `:3001` directly loads the page but
  on a different origin, so the shared-storage reset will not work there.
- Moving between the apps must be a full page load (`window.location`), not `next/link` or
  `router.push`, because they are separate Next builds.

### Which function to use when

| You want | Call | App 1's own store |
|---|---|---|
| Search: wipe the booking data, keep the search form | `clearApps([APP_KEYS.booking])` | untouched |
| Sign-out: wipe every app, including this one | `resetEverything(store.dispatch)` | reset |
| Wipe only some slices of one app | `dispatch(resetSlices(["confirmations"]))` | only those slices reset |

### How `clearApps([APP_KEYS.booking])` works (3 parts, as in section 2)

1. It deletes the booking app's **saved copy** (`persist:booking-demo`) from the shared `localStorage`.
2. It sends a `BroadcastChannel` message **aimed at** `booking-demo`. If the booking app is open
   in another tab, its `listenForReset` sees it is a target, and resets its live store.
3. Every other app ignores the message, because its key is not in the target list. That
   includes app 1, so the search form survives.

An app that is closed needs no message: it boots later from the deleted saved copy and
starts empty.

### Try it locally

```bash
# terminal 1: app 2 (port 3001, basePath /booking)
pnpm --filter booking-app dev

# terminal 2: app 1 (port 3000), proxying /booking to app 2 so both share one origin
BOOKING_APP_URL=http://localhost:3001 pnpm --filter frontend dev
```

1. Open `http://localhost:3000/store-reset-demo` and type something in the search box.
2. In a second tab open `http://localhost:3000/booking` and fill the booking form.
3. Back in tab 1 press **Search**. The booking tab empties (even after a refresh); the search
   box in tab 1 keeps its text (also after a refresh).

(On Windows PowerShell set the variable first: `$env:BOOKING_APP_URL="http://localhost:3001"`.)
Open the booking app through port **3000**, not 3001, so both apps share one origin.

### Adding another app

1. Wrap its root reducer in `withResetAll`.
2. Add its persist key to `APP_KEYS` and use that constant as its redux-persist `key`.
3. Call `useEffect(() => listenForReset(store.dispatch, { key: APP_KEYS.yourApp }), [])` once on the client.

### Known limits

- `APP_KEYS` is a hard-coded list in the shared package. An app missing from it cannot be
  targeted by another app's `clearApps`.
- `BroadcastChannel` is unavailable in very old browsers; those would only get the saved-copy
  deletion, not the live reset of other open tabs.
- Only same-origin apps are covered. Different domains need a server-side approach.
- The middleware matcher in `apps/frontend/proxy.ts` excludes `/booking` so the locale
  middleware does not touch the second app's paths.
- The real `SearchSection` component is **not** wired to `clearApps` yet (only the demo page is).
