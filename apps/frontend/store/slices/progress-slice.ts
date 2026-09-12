import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import { STEP_ORDER, type StepId } from "@/lib/steps";

export type ProgressState = {
  current: StepId;
  visited: StepId[];
};

const initialState: ProgressState = {
  current: STEP_ORDER[0],
  visited: [],
};

const progressSlice = createSlice({
  name: "progress",
  initialState,
  reducers: {
    setCurrent(state, action: PayloadAction<StepId>) {
      state.current = action.payload;
    },
    // Adds to the visited set without ever removing from it — a step must
    // never revert from visited back to unvisited.
    markVisited(state, action: PayloadAction<StepId>) {
      if (!state.visited.includes(action.payload)) {
        state.visited.push(action.payload);
      }
    },
  },
});

export const { setCurrent, markVisited } = progressSlice.actions;
export default progressSlice.reducer;
