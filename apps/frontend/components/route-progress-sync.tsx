"use client";

import { useEffect } from "react";

import { useAppDispatch } from "@/store/hooks";
import { markVisited, setCurrent } from "@/store/slices/progress-slice";
import type { StepId } from "@/lib/steps";

/**
 * Marks the given step as current and visited in the progress store.
 * Mounted once per step page so current/visited state always reflects the
 * actual route, not just whatever a component happened to set locally.
 */
export function RouteProgressSync({ stepId }: { stepId: StepId }) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(setCurrent(stepId));
    dispatch(markVisited(stepId));
  }, [dispatch, stepId]);

  return null;
}
