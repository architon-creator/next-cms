import { combineReducers, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  APP_KEYS,
  clearApps,
  listenForReset,
  resetAll,
  resetEverything,
  resetSlices,
  withResetAll,
} from "./index";

const counter = createSlice({
  name: "counter",
  initialState: { value: 0 },
  reducers: { set: (s, a: PayloadAction<number>) => void (s.value = a.payload) },
});
const note = createSlice({
  name: "note",
  initialState: { text: "" },
  reducers: { set: (s, a: PayloadAction<string>) => void (s.text = a.payload) },
});

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    keys: () => [...map.keys()],
  };
}

describe("withResetAll", () => {
  const reducer = withResetAll(combineReducers({ counter: counter.reducer, note: note.reducer }));
  const filled = () => {
    let state = reducer(undefined, { type: "@@init" });
    state = reducer(state, counter.actions.set(7));
    return reducer(state, note.actions.set("hi"));
  };

  it("resetAll returns every slice to its initial state", () => {
    expect(filled()).toEqual({ counter: { value: 7 }, note: { text: "hi" } });
    expect(reducer(filled(), resetAll())).toEqual({ counter: { value: 0 }, note: { text: "" } });
  });

  it("resetSlices resets only the named slices and keeps the rest", () => {
    expect(reducer(filled(), resetSlices(["note"]))).toEqual({
      counter: { value: 7 },
      note: { text: "" },
    });
  });

  it("leaves state alone for other actions", () => {
    const state = reducer(undefined, counter.actions.set(3));
    expect(reducer(state, { type: "something/else" })).toBe(state);
  });
});

describe("clearApps / resetEverything / listenForReset", () => {
  let storage: ReturnType<typeof memoryStorage>;

  beforeEach(() => {
    storage = memoryStorage();
    vi.stubGlobal("localStorage", storage);
    storage.setItem(`persist:${APP_KEYS.stepper}`, "{}");
    storage.setItem(`persist:${APP_KEYS.booking}`, "{}");
    storage.setItem("persist:unrelated", "{}");
  });
  afterEach(() => vi.unstubAllGlobals());

  it("clearApps deletes ONLY the targeted app's saved copy", () => {
    clearApps([APP_KEYS.booking]);

    expect(storage.keys().sort()).toEqual([`persist:${APP_KEYS.stepper}`, "persist:unrelated"]);
  });

  it("clearApps resets the targeted open app but NOT the caller or other apps", async () => {
    const searchApp = vi.fn(); // the app that keeps its search form
    const bookingApp = vi.fn();
    const stopSearch = listenForReset(searchApp, { key: APP_KEYS.stepper });
    const stopBooking = listenForReset(bookingApp, { key: APP_KEYS.booking });

    clearApps([APP_KEYS.booking]);

    await vi.waitFor(() => expect(bookingApp).toHaveBeenCalledWith(resetAll()));
    // give the channel time to (not) deliver anything to the search app
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(searchApp).not.toHaveBeenCalled();

    stopSearch();
    stopBooking();
  });

  it("resetEverything resets the caller, deletes every saved copy, and resets other open apps", async () => {
    const callerDispatch = vi.fn();
    const otherApp = vi.fn();
    const stop = listenForReset(otherApp, { key: APP_KEYS.booking });

    resetEverything(callerDispatch);

    expect(callerDispatch).toHaveBeenCalledWith(resetAll());
    expect(storage.keys()).toEqual(["persist:unrelated"]);
    await vi.waitFor(() => expect(otherApp).toHaveBeenCalledWith(resetAll()));

    stop();
  });

  it("does not throw when localStorage is unavailable", () => {
    vi.stubGlobal("localStorage", undefined);
    expect(() => clearApps([APP_KEYS.booking])).not.toThrow();
    expect(() => resetEverything(vi.fn())).not.toThrow();
  });
});
