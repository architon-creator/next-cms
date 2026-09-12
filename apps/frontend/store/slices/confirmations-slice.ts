import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import type { DataStepId } from "@/lib/steps";

import {
  setContactInfo,
  setDocuments,
  setPersonalDetails,
  setPreferences,
} from "./form-data-slice";

export type ConfirmationsState = Record<DataStepId, boolean>;

const initialState: ConfirmationsState = {
  "personal-details": false,
  "contact-info": false,
  preferences: false,
  documents: false,
};

const confirmationsSlice = createSlice({
  name: "confirmations",
  initialState,
  reducers: {
    confirmSection(state, action: PayloadAction<DataStepId>) {
      state[action.payload] = true;
    },
    resetSectionConfirmation(state, action: PayloadAction<DataStepId>) {
      state[action.payload] = false;
    },
  },
  // Saving a section's data again (e.g. via the "Change" edit flow) resets
  // its confirmed state — a confirmation only reflects what was reviewed,
  // never data entered after that review.
  extraReducers: (builder) => {
    builder
      .addCase(setPersonalDetails, (state) => {
        state["personal-details"] = false;
      })
      .addCase(setContactInfo, (state) => {
        state["contact-info"] = false;
      })
      .addCase(setPreferences, (state) => {
        state.preferences = false;
      })
      .addCase(setDocuments, (state) => {
        state.documents = false;
      });
  },
});

export const { confirmSection, resetSectionConfirmation } = confirmationsSlice.actions;
export default confirmationsSlice.reducer;
