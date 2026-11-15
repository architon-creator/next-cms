import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type SearchState = { query: string };

const initialState: SearchState = { query: "" };

// The search form's own values. Clicking Search must keep these while it clears the
// booking app's data (see clearApps in packages/app-state), so this slice is
// deliberately NOT listed in anything the Search button resets.
const searchSlice = createSlice({
  name: "search",
  initialState,
  reducers: {
    setSearchQuery(state, action: PayloadAction<string>) {
      state.query = action.payload;
    },
  },
});

export const { setSearchQuery } = searchSlice.actions;
export default searchSlice.reducer;
