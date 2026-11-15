import { combineReducers } from "@reduxjs/toolkit";
import { persistReducer } from "redux-persist";
import storage from "redux-persist/lib/storage";

import { APP_KEYS, withResetAll } from "app-state";

import confirmations from "./slices/confirmations-slice";
import formData from "./slices/form-data-slice";
import progress from "./slices/progress-slice";
import search from "./slices/search-slice";

// withResetAll lets the shared `resetAll` / `resetSlices` actions reset these slices.
// The Search button does NOT reset this app: it calls clearApps([APP_KEYS.booking]) to
// wipe the booking app's data while `search` (the search form) stays untouched.
// This app's persist key comes from app-state's APP_KEYS so other apps can find it.
const rootReducer = withResetAll(combineReducers({ formData, confirmations, progress, search }));

export const persistedReducer = persistReducer(
  {
    key: APP_KEYS.stepper,
    version: 1,
    storage,
    // Only the stepper flow's own data — nothing transient/UI-only.
    whitelist: ["formData", "confirmations", "progress", "search"],
  },
  rootReducer,
);

// Includes redux-persist's own `_persist` field (rehydration status),
// which RouteGuard reads before trusting persisted state.
export type RootState = ReturnType<typeof persistedReducer>;
