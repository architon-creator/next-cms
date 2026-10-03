"use client";

import * as React from "react";
import { cn } from "cn";
import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox";
import { CheckIcon, ChevronDownIcon, XIcon } from "lucide-react";

import { Button } from "./button";

/** Re-exported as-is — `Combobox.Root` renders no DOM of its own. */
const Combobox = ComboboxPrimitive.Root;

function ComboboxValue(props: ComboboxPrimitive.Value.Props) {
  return <ComboboxPrimitive.Value {...props} />;
}

function ComboboxChips({
  className,
  ...props
}: ComboboxPrimitive.Chips.Props) {
  return (
    <ComboboxPrimitive.Chips
      data-slot="combobox-chips"
      className={cn(
        "flex min-h-9 w-full flex-wrap items-center gap-1 rounded-lg border border-input bg-background px-2 py-1.5 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
        className,
      )}
      {...props}
    />
  );
}

function ComboboxChip({
  className,
  children,
  showRemove = true,
  removeLabel,
  ...props
}: ComboboxPrimitive.Chip.Props & {
  showRemove?: boolean;
  removeLabel?: string;
}) {
  return (
    <ComboboxPrimitive.Chip
      data-slot="combobox-chip"
      className={cn(
        "flex h-7 w-fit items-center justify-center gap-1 rounded-md bg-primary py-0.5 pr-1 pl-2.5 text-xs font-medium text-primary-foreground",
        className,
      )}
      {...props}
    >
      {children}
      {showRemove ? (
        <ComboboxPrimitive.ChipRemove
          render={<Button type="button" variant="ghost" size="icon-xs" />}
          aria-label={removeLabel}
          className="-ml-1 text-primary-foreground opacity-70 hover:bg-primary-foreground/10 hover:text-primary-foreground hover:opacity-100"
          data-slot="combobox-chip-remove"
        >
          <XIcon className="pointer-events-none" />
        </ComboboxPrimitive.ChipRemove>
      ) : null}
    </ComboboxPrimitive.Chip>
  );
}

function ComboboxChipsInput({
  className,
  ...props
}: ComboboxPrimitive.Input.Props) {
  return (
    <ComboboxPrimitive.Input
      data-slot="combobox-chip-input"
      className={cn(
        "h-6 min-w-16 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

function ComboboxTrigger({
  className,
  children,
  ...props
}: ComboboxPrimitive.Trigger.Props) {
  return (
    <ComboboxPrimitive.Trigger
      data-slot="combobox-trigger"
      className={cn("shrink-0 text-muted-foreground", className)}
      {...props}
    >
      {children ?? (
        <ComboboxPrimitive.Icon>
          <ChevronDownIcon className="size-4" />
        </ComboboxPrimitive.Icon>
      )}
    </ComboboxPrimitive.Trigger>
  );
}

function ComboboxClear({ className, ...props }: ComboboxPrimitive.Clear.Props) {
  return (
    <ComboboxPrimitive.Clear
      data-slot="combobox-clear"
      render={<Button type="button" variant="ghost" size="icon-xs" />}
      className={cn("shrink-0", className)}
      {...props}
    >
      <XIcon />
    </ComboboxPrimitive.Clear>
  );
}

/** Portal + Positioner + Popup, collapsed into one component — the three only ever appear together. */
function ComboboxContent({
  className,
  sideOffset = 4,
  anchor,
  ...props
}: ComboboxPrimitive.Popup.Props &
  Pick<ComboboxPrimitive.Positioner.Props, "sideOffset" | "anchor">) {
  return (
    <ComboboxPrimitive.Portal>
      <ComboboxPrimitive.Positioner
        sideOffset={sideOffset}
        anchor={anchor}
        className="z-50 w-(--anchor-width)"
      >
        <ComboboxPrimitive.Popup
          data-slot="combobox-content"
          className={cn(
            "max-h-72 overflow-y-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-md",
            className,
          )}
          {...props}
        />
      </ComboboxPrimitive.Positioner>
    </ComboboxPrimitive.Portal>
  );
}

function ComboboxList({
  className,
  initialScrollPosition = "start",
  ...props
}: ComboboxPrimitive.List.Props & { initialScrollPosition?: "start" | "end" }) {
  const listRef = React.useRef<HTMLDivElement | null>(null);

  React.useLayoutEffect(() => {
    if (initialScrollPosition !== "end") return;
    const listElement = listRef.current;
    if (!listElement) return;

    const frameId = requestAnimationFrame(() => {
      listElement.scrollTop = listElement.scrollHeight;
    });
    return () => cancelAnimationFrame(frameId);
  }, [initialScrollPosition]);

  return (
    <ComboboxPrimitive.List
      ref={listRef}
      data-slot="combobox-list"
      className={cn("overflow-y-auto overscroll-contain py-1", className)}
      {...props}
    />
  );
}

function ComboboxEmpty({ className, ...props }: ComboboxPrimitive.Empty.Props) {
  return (
    <ComboboxPrimitive.Empty
      data-slot="combobox-empty"
      className={cn(
        "hidden w-full justify-center py-6 text-center text-sm text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

function ComboboxGroup({ className, ...props }: ComboboxPrimitive.Group.Props) {
  return (
    <ComboboxPrimitive.Group
      data-slot="combobox-group"
      className={cn(className)}
      {...props}
    />
  );
}

function ComboboxLabel({ className, ...props }: ComboboxPrimitive.GroupLabel.Props) {
  return (
    <ComboboxPrimitive.GroupLabel
      data-slot="combobox-label"
      className={cn("px-2 py-1.5 text-xs font-medium text-muted-foreground", className)}
      {...props}
    />
  );
}

function ComboboxItem({ className, children, ...props }: ComboboxPrimitive.Item.Props) {
  return (
    <ComboboxPrimitive.Item
      data-slot="combobox-item"
      className={cn(
        "relative flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm select-none",
        "data-highlighted:bg-muted",
        "data-disabled:pointer-events-none data-disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <span className="flex-1">{children}</span>
      <ComboboxPrimitive.ItemIndicator
        render={<span className="pointer-events-none flex shrink-0 items-center justify-center" />}
      >
        <CheckIcon className="size-4 text-primary" />
      </ComboboxPrimitive.ItemIndicator>
    </ComboboxPrimitive.Item>
  );
}

function ComboboxCollection(props: ComboboxPrimitive.Collection.Props) {
  return <ComboboxPrimitive.Collection data-slot="combobox-collection" {...props} />;
}

function ComboboxSeparator({ className, ...props }: ComboboxPrimitive.Separator.Props) {
  return (
    <ComboboxPrimitive.Separator
      data-slot="combobox-separator"
      className={cn("-mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  );
}

/**
 * A ref for `Combobox.Positioner`'s `anchor` prop, pointed at the `Chips`
 * row (via `ComboboxChips`' own `ref`) so the dropdown's width tracks the
 * chips container rather than the whole field, including the trailing
 * trigger button.
 */
function useComboboxAnchor() {
  return React.useRef<HTMLDivElement | null>(null);
}

export {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxClear,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxSeparator,
  ComboboxTrigger,
  ComboboxValue,
  useComboboxAnchor,
};
