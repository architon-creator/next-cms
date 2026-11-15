"use client";

import { useEffect, useState } from "react";
import { Provider, useDispatch, useSelector } from "react-redux";

import { APP_KEYS, listenForReset, resetAll } from "app-state";

import { setDestination, setNote, setPassengers } from "@/store/booking-slice";
import { store, type AppDispatch, type RootState } from "@/store/store";

// Reads app 1's saved search text straight from the shared localStorage (same origin).
// redux-persist stores each slice as a JSON string inside "persist:<key>".
function readSearchQuery(): string | null {
  try {
    const raw = localStorage.getItem(`persist:${APP_KEYS.stepper}`);
    if (!raw) return null;
    const search = (JSON.parse(raw) as { search?: string }).search;
    return search ? (JSON.parse(search) as { query: string }).query : null;
  } catch {
    return null;
  }
}

const panel = { background: "#f4f4f5", padding: 12, fontSize: 12, margin: 0 } as const;

function Demo() {
  const dispatch = useDispatch<AppDispatch>();
  const booking = useSelector((state: RootState) => state.booking);
  const [searchQuery, setSearchQuery] = useState<string | null>(null);

  // When app 1's Search button clears the booking app, reset this store too.
  useEffect(() => listenForReset(store.dispatch, { key: APP_KEYS.booking }), []);

  // Show what the search app saved, and keep it fresh if app 1 changes it in another tab.
  useEffect(() => {
    setSearchQuery(readSearchQuery());
    const refresh = () => setSearchQuery(readSearchQuery());
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
  }, []);

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <p>
        This app&apos;s store (<code>{APP_KEYS.booking}</code>). Fill it, then press Search in{" "}
        <a href="/store-reset-demo">app 1</a>: this booking data is deleted, and app 1&apos;s search
        text is kept.
      </p>

      <button
        type="button"
        onClick={() => {
          dispatch(setDestination("Tokyo"));
          dispatch(setPassengers(2));
          dispatch(setNote("Window seats, vegetarian meals"));
        }}
      >
        Fill sample booking
      </button>

      <input
        placeholder="Destination"
        value={booking.destination}
        onChange={(event) => dispatch(setDestination(event.target.value))}
      />
      <input
        type="number"
        min={1}
        value={booking.passengers}
        onChange={(event) => dispatch(setPassengers(Number(event.target.value)))}
      />
      <input
        placeholder="Note"
        value={booking.note}
        onChange={(event) => dispatch(setNote(event.target.value))}
      />
      <button type="button" onClick={() => dispatch(resetAll())}>
        Clear booking data
      </button>

      <h2 style={{ fontSize: 14, margin: "8px 0 0" }}>Booking app store (this app)</h2>
      <pre style={panel}>{JSON.stringify({ booking }, null, 2)}</pre>

      <h2 style={{ fontSize: 14, margin: "8px 0 0" }}>Search text saved by app 1 (read from localStorage)</h2>
      <pre style={panel}>
        {searchQuery === null ? "(nothing saved)" : JSON.stringify({ query: searchQuery }, null, 2)}
      </pre>
    </section>
  );
}

export function BookingDemo() {
  return (
    <Provider store={store}>
      <Demo />
    </Provider>
  );
}
