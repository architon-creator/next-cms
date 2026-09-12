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
    // Starts a fresh run of the flow (e.g. selecting a search result) —
    // otherwise a previously completed run's visited/current state would
    // leak into what should be a brand new pass through the steps.
    startNewFlow() {
      return initialState;
    },
  },
});

export const { setCurrent, markVisited, startNewFlow } = progressSlice.actions;
export default progressSlice.reducer;
