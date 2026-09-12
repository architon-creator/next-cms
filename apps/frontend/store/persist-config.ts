import { combineReducers } from "@reduxjs/toolkit";
import { persistReducer } from "redux-persist";
import storage from "redux-persist/lib/storage";

import confirmations from "./slices/confirmations-slice";
import formData from "./slices/form-data-slice";
import progress from "./slices/progress-slice";

const rootReducer = combineReducers({ formData, confirmations, progress });

export const persistedReducer = persistReducer(
  {
    key: "next-cms-stepper",
    version: 1,
    storage,
    // Only the stepper flow's own data — nothing transient/UI-only.
    whitelist: ["formData", "confirmations", "progress"],
  },
  rootReducer,
);

// Includes redux-persist's own `_persist` field (rehydration status),
// which RouteGuard reads before trusting persisted state.
export type RootState = ReturnType<typeof persistedReducer>;
