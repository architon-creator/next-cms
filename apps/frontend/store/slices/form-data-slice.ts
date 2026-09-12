import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import type { ContactInfoValues } from "@/lib/schemas/contact-info-schema";
import type { DocumentsValues } from "@/lib/schemas/documents-schema";
import type { PersonalDetailsValues } from "@/lib/schemas/personal-details-schema";
import type { PreferencesValues } from "@/lib/schemas/preferences-schema";

export type FormDataState = {
  personalDetails: PersonalDetailsValues | null;
  contactInfo: ContactInfoValues | null;
  preferences: PreferencesValues | null;
  documents: DocumentsValues | null;
};

const initialState: FormDataState = {
  personalDetails: null,
  contactInfo: null,
  preferences: null,
  documents: null,
};

const formDataSlice = createSlice({
  name: "formData",
  initialState,
  reducers: {
    setPersonalDetails(state, action: PayloadAction<PersonalDetailsValues>) {
      state.personalDetails = action.payload;
    },
    setContactInfo(state, action: PayloadAction<ContactInfoValues>) {
      state.contactInfo = action.payload;
    },
    setPreferences(state, action: PayloadAction<PreferencesValues>) {
      state.preferences = action.payload;
    },
    setDocuments(state, action: PayloadAction<DocumentsValues>) {
      state.documents = action.payload;
    },
  },
});

export const { setPersonalDetails, setContactInfo, setPreferences, setDocuments } =
  formDataSlice.actions;
export default formDataSlice.reducer;
