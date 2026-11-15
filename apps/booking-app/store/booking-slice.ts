import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type BookingState = { destination: string; passengers: number; note: string };

const initialState: BookingState = { destination: "", passengers: 1, note: "" };

const bookingSlice = createSlice({
  name: "booking",
  initialState,
  reducers: {
    setDestination(state, action: PayloadAction<string>) {
      state.destination = action.payload;
    },
    setPassengers(state, action: PayloadAction<number>) {
      state.passengers = action.payload;
    },
    setNote(state, action: PayloadAction<string>) {
      state.note = action.payload;
    },
  },
});

export const { setDestination, setPassengers, setNote } = bookingSlice.actions;
export default bookingSlice.reducer;
