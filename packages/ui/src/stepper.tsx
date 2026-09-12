import { Check } from "lucide-react";
import { cn } from "cn";

export type StepperStep = {
  id: string;
  label: string;
};

export type StepperProps = {
  steps: StepperStep[];
  current: string;
  visited: string[];
};

// Display-only: no click handlers on individual steps, by design (the
// stepper never drives navigation — Next/Back buttons do).
function Stepper({ steps, current, visited }: StepperProps) {
  return (
    <ol className="flex w-full items-start gap-2" aria-label="Progress">
      {steps.map((step) => {
        const isCurrent = step.id === current;
        const isVisited = !isCurrent && visited.includes(step.id);
        const state = isCurrent ? "current" : isVisited ? "visited" : "unvisited";

        return (
          <li
            key={step.id}
            className="flex flex-1 flex-col items-center gap-1.5 text-center"
            aria-current={isCurrent ? "step" : undefined}
          >
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-medium",
                state === "current" && "border-primary bg-primary text-primary-foreground",
                state === "visited" && "border-primary bg-background text-primary",
                state === "unvisited" && "border-border bg-background text-muted-foreground",
              )}
            >
              {state === "visited" ? <Check className="h-3.5 w-3.5" /> : null}
            </span>
            <span
              className={cn(
                "text-xs font-medium",
                state === "unvisited" ? "text-muted-foreground" : "text-foreground",
              )}
            >
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export { Stepper };
