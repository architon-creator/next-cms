import { createAction, type Action, type Reducer } from "@reduxjs/toolkit";

/**
 * Cross-app store clearing for Next apps that share ONE origin
 * (e.g. ab.com/en and ab.com/booking/en). Same origin means they share
 * `localStorage` and can talk over a `BroadcastChannel`; they do NOT share
 * in-memory stores, so clearing another app has three parts:
 *
 *   1. delete that app's saved copy      -> removed from localStorage
 *   2. reset that app's store if it is open -> BroadcastChannel (`listenForReset`)
 *   3. (own store) reset slices             -> `resetSlices` / `resetAll`
 *
 * An app that is closed needs no message: it boots later from the (now
 * deleted) saved copy, so it starts empty.
 *
 * Typical use: the SEARCH app clears the BOOKING app's data but keeps its own
 * search form:  `clearApps([APP_KEYS.booking])`.
 */

/** redux-persist keys, one per app. Each app's persistReducer must use its key. */
export const APP_KEYS = {
  stepper: "next-cms-stepper",
  booking: "booking-demo",
} as const;

export type AppKey = (typeof APP_KEYS)[keyof typeof APP_KEYS];

/** Every registered app. Add a new app's key here AND to APP_KEYS. */
export const PERSIST_KEYS: readonly AppKey[] = Object.values(APP_KEYS);

/** Return EVERY slice of the receiving store to its initial state. */
export const resetAll = createAction("app/resetAll");

/** Return only the named slices to their initial state, leaving the rest as they are. */
export const resetSlices = createAction<readonly string[]>("app/resetSlices");

const PERSIST_PREFIX = "persist:"; // redux-persist's localStorage key prefix
const CHANNEL_NAME = "app-state";

/** `targets` omitted = every app. Otherwise only apps whose key is listed reset. */
type ResetMessage = { type: "reset"; targets?: readonly string[] };

/**
 * Wrap an app's root reducer so `resetAll` / `resetSlices` work for every slice,
 * including slices added later, without each slice listening for the action.
 */
export function withResetAll<S, A extends Action = Action>(
  reducer: Reducer<S, A>,
): Reducer<S, A> {
  return (state, action) => {
    if (resetAll.match(action)) {
      return reducer(undefined, action);
    }

    if (resetSlices.match(action) && state) {
      // Dropping a key makes combineReducers rebuild that slice from its initial state.
      const next: Record<string, unknown> = { ...(state as Record<string, unknown>) };
      for (const name of action.payload) {
        delete next[name];
      }
      return reducer(next as S, action);
    }

    return reducer(state, action);
  };
}

function getStorage(): Storage | undefined {
  try {
    return typeof localStorage === "undefined" ? undefined : localStorage;
  } catch {
    // localStorage can throw (e.g. blocked site data) — clearing still works in memory.
    return undefined;
  }
}

function removeSavedCopies(keys: readonly string[]) {
  const storage = getStorage();
  for (const key of keys) {
    storage?.removeItem(PERSIST_PREFIX + key);
  }
}

function broadcast(message: ResetMessage) {
  if (typeof BroadcastChannel === "undefined") return;

  const channel = new BroadcastChannel(CHANNEL_NAME);
  channel.postMessage(message);
  channel.close();
}

/**
 * Clear specific apps (their saved copy now, and their live store if open)
 * WITHOUT touching the calling app. Use this from the Search button to wipe the
 * booking app while keeping the search form.
 */
export function clearApps(targets: readonly string[]) {
  removeSavedCopies(targets);
  broadcast({ type: "reset", targets });
}

/**
 * Clear EVERY registered app including the caller (e.g. on sign-out). The caller
 * passes its own `dispatch` so its in-memory store resets immediately.
 */
export function resetEverything(
  dispatch: (action: Action) => unknown,
  keys: readonly string[] = PERSIST_KEYS,
) {
  removeSavedCopies(keys);
  dispatch(resetAll());
  broadcast({ type: "reset" });
}

/**
 * Call once per app on the client. When ANOTHER tab/app clears this app (or
 * everything), this app resets its own store. `key` is this app's persist key.
 * Returns a cleanup function.
 */
export function listenForReset(
  dispatch: (action: Action) => unknown,
  options: { key: string },
) {
  if (typeof BroadcastChannel === "undefined") {
    return () => {};
  }

  const channel = new BroadcastChannel(CHANNEL_NAME);

  channel.onmessage = (event: MessageEvent<ResetMessage>) => {
    if (event.data?.type !== "reset") return;

    const { targets } = event.data;
    if (targets && !targets.includes(options.key)) return; // not aimed at this app

    removeSavedCopies([options.key]);
    dispatch(resetAll());
  };

  return () => channel.close();
}
