"use client";

import * as React from "react";
import { cn } from "cn";
import { XIcon } from "lucide-react";

import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from "./combobox";
import { Label } from "./label";

export type TagComboboxProps = {
  /** Flat list of selectable tags — no category grouping. */
  tags: string[];
  value: string[];
  onChange: (value: string[]) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  /**
   * "inside": selected tags render as chips inside the input box.
   * "below": the input box stays a plain search field, and selected tags
   * render as a separate removable row underneath.
   * @default "below"
   */
  chipsPlacement?: "inside" | "below";
};

/**
 * A multi-select tag picker over a flat tag list — a thin consumer of the
 * `combobox.tsx` primitives.
 *
 * Filtering happens here, not via `Combobox`'s built-in filtering, so the
 * same `inputValue`-driven narrowing is used whether or not grouping is
 * ever added back.
 */
export function TagCombobox({
  tags,
  value,
  onChange,
  label,
  placeholder = "Select tag...",
  className,
  chipsPlacement = "below",
}: TagComboboxProps) {
  const [inputValue, setInputValue] = React.useState("");
  const anchorRef = useComboboxAnchor();

  const filteredTags = React.useMemo(() => {
    const query = inputValue.trim().toLowerCase();
    if (!query) return tags;
    return tags.filter((tag) => tag.toLowerCase().includes(query));
  }, [tags, inputValue]);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {label ? <Label>{label}</Label> : null}

      <Combobox
        multiple
        items={filteredTags}
        value={value}
        onValueChange={(next) => onChange(next ?? [])}
        inputValue={inputValue}
        onInputValueChange={setInputValue}
      >
        <ComboboxChips ref={anchorRef}>
          {chipsPlacement === "inside" ? (
            <ComboboxValue>
              {(selectedTags: string[]) =>
                selectedTags.map((tag) => (
                  <ComboboxChip key={tag} removeLabel={`Remove ${tag}`}>
                    {tag}
                  </ComboboxChip>
                ))
              }
            </ComboboxValue>
          ) : null}
          <ComboboxChipsInput
            placeholder={chipsPlacement === "inside" && value.length > 0 ? "" : placeholder}
            aria-label={label ?? placeholder}
          />
        </ComboboxChips>

        <ComboboxContent anchor={anchorRef}>
          <ComboboxEmpty>No tag found.</ComboboxEmpty>
          <ComboboxList>
            {filteredTags.map((tag) => (
              <ComboboxItem key={tag} value={tag}>
                {tag}
              </ComboboxItem>
            ))}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>

      {chipsPlacement === "below" && value.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {value.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => onChange(value.filter((item) => item !== tag))}
              aria-label={`Remove ${tag}`}
              className="flex h-7 items-center gap-1 rounded-md bg-primary py-0.5 pr-1 pl-2.5 text-xs font-medium text-primary-foreground"
            >
              {tag}
              <XIcon className="size-3.5 opacity-70 hover:opacity-100" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
