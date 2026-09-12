"use client";

import { Provider } from "react-redux";

import { store } from "@/store/store";

// Deliberately no <PersistGate> here: gating on it would block the ENTIRE
// app's first render (Header, Footer, every existing page) until
// redux-persist rehydrates, not just the stepper flow. redux-persist
// still attaches `_persist.rehydrated` to state on its own regardless of
// PersistGate — RouteGuard reads that directly and gates only itself,
// which is the only part of the app that actually needs it.
export function ReduxProvider({ children }: { children: React.ReactNode }) {
  return <Provider store={store}>{children}</Provider>;
}
