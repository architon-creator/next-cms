import * as React from "react";
import { cn } from "cn";

function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn(
        "flex items-center gap-2 text-sm leading-none font-medium text-foreground select-none",
        "has-disabled:pointer-events-none has-disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Label };
