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
    <div className="w-full" aria-label="Progress">
      <ol className="flex items-center">
        {steps.map((step, index) => {
          const isCurrent = step.id === current;
          const isVisited = !isCurrent && visited.includes(step.id);
          const state = isCurrent ? "current" : isVisited ? "visited" : "unvisited";
          const isLast = index === steps.length - 1;

          return (
            <li
              key={step.id}
              className={cn("flex items-center", !isLast && "flex-1")}
              aria-current={isCurrent ? "step" : undefined}
            >
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors",
                  state === "current" &&
                    "border-primary bg-primary text-primary-foreground",
                  state === "visited" && "border-primary bg-primary/10 text-primary",
                  state === "unvisited" &&
                    "border-border bg-background text-muted-foreground",
                )}
              >
                {state === "visited" ? <Check className="h-4 w-4" /> : index + 1}
              </span>
              {!isLast && (
                <span
                  className={cn(
                    "mx-2 h-0.5 flex-1 rounded-full transition-colors",
                    state === "visited" ? "bg-primary" : "bg-border",
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>

      <ol className="mt-2 flex">
        {steps.map((step) => {
          const isCurrent = step.id === current;
          const isVisited = !isCurrent && visited.includes(step.id);

          return (
            <li
              key={step.id}
              className={cn(
                "flex-1 px-1 text-center text-xs font-medium first:text-left last:text-right",
                isCurrent || isVisited ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {step.label}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export { Stepper };
