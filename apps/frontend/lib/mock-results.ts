export type MockResult = {
  id: string;
  name: string;
  detail: string;
};

// Placeholder data — the real search fields/dataset are not yet defined
// (see search-stepper-requirement.md section 1).
export const MOCK_RESULTS: MockResult[] = [
  { id: "1", name: "Alex Johnson", detail: "Member since 2021" },
  { id: "2", name: "Priya Sharma", detail: "Member since 2019" },
  { id: "3", name: "Wei Chen", detail: "Member since 2022" },
  { id: "4", name: "Fatima Al-Sayed", detail: "Member since 2020" },
  { id: "5", name: "Diego Martinez", detail: "Member since 2023" },
  { id: "6", name: "Emma Wilson", detail: "Member since 2018" },
];
