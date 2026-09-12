"use client";

import { useEffect } from "react";

import { useRouter } from "@/i18n/navigation";
import { previousStep, type StepId } from "@/lib/steps";
import { useAppSelector } from "@/store/hooks";

/**
 * Prevents skipping ahead by typing a step URL directly. Runs client-side
 * (not in middleware.ts) because it needs redux-persist's rehydrated state,
 * which middleware — running at the edge, before any client storage is
 * readable — has no access to.
 */
export function RouteGuard({
  stepId,
  children,
}: {
  stepId: StepId;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const rehydrated = useAppSelector((state) => state._persist?.rehydrated ?? false);
  const visited = useAppSelector((state) => state.progress.visited);

  const required = previousStep(stepId);
  // `progress.current` is not used here: it defaults to the first step
  // before any real navigation happens, which would make that default
  // look like genuine progress. Only the explicitly-marked `visited` set
  // (populated by RouteProgressSync once a step is actually reached)
  // counts as having completed a step.
  const reached = required === null || visited.includes(required);

  useEffect(() => {
    if (rehydrated && !reached) {
      router.replace("/");
    }
  }, [rehydrated, reached, router]);

  // Nothing rendered until rehydration confirms this step is reachable —
  // avoids a flash of guarded content or a premature redirect.
  if (!rehydrated || !reached) {
    return null;
  }

  return <>{children}</>;
}
