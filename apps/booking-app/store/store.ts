import { combineReducers, configureStore } from "@reduxjs/toolkit";
import {
  FLUSH,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
  REHYDRATE,
  persistReducer,
  persistStore,
} from "redux-persist";
import storage from "redux-persist/lib/storage";

import { APP_KEYS, withResetAll } from "app-state";

import booking from "./booking-slice";

// The shared `resetAll` action (sent by app 1's Search button via clearApps) resets every slice here.
const rootReducer = withResetAll(combineReducers({ booking }));

// The key comes from app-state's APP_KEYS so app 1 can delete this app's saved copy
// straight out of the shared localStorage.
const persistedReducer = persistReducer(
  { key: APP_KEYS.booking, version: 1, storage, whitelist: ["booking"] },
  rootReducer,
);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: { ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER] },
    }),
});

export const persistor = persistStore(store);
export type RootState = ReturnType<typeof persistedReducer>;
export type AppDispatch = typeof store.dispatch;
