import { notFound } from "next/navigation";
import { isLabelsToolEnabled } from "@/lib/labels-guard";
import LabelsClient from "./LabelsClient";

export const metadata = { title: "Labels · admin-app" };

export default function LabelsPage() {
  // Same fail-closed-outside-dev guard as the /api/labels/* routes (see
  // lib/labels-guard.ts) — a disabled deployment shouldn't even show this
  // page exists, not just reject its API calls.
  if (!isLabelsToolEnabled()) {
    notFound();
  }
  return <LabelsClient />;
}
