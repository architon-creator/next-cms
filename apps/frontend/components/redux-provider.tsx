"use client";

import { useEffect } from "react";
import { Provider } from "react-redux";

import { APP_KEYS, listenForReset } from "app-state";

import { store } from "@/store/store";

// Deliberately no <PersistGate> here: gating on it would block the ENTIRE
// app's first render (Header, Footer, every existing page) until
// redux-persist rehydrates, not just the stepper flow. redux-persist
// still attaches `_persist.rehydrated` to state on its own regardless of
// PersistGate — RouteGuard reads that directly and gates only itself,
// which is the only part of the app that actually needs it.
export function ReduxProvider({ children }: { children: React.ReactNode }) {
  // When another tab/app on this origin clears THIS app (or everything), reset too.
  useEffect(() => listenForReset(store.dispatch, { key: APP_KEYS.stepper }), []);

  return <Provider store={store}>{children}</Provider>;
}
