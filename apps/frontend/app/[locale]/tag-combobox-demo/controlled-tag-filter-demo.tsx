"use client";

import { useState } from "react";
import { XIcon } from "lucide-react";

import {
  Card,
  CardContent,
  Combobox,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  useComboboxAnchor,
} from "ui";

const TAG_OPTIONS = ["Halal", "Drink", "Set", "Chicken"];

/**
 * Fixed version of the real project's `FieldComboboxChips` usage: `open`
 * is still externally controlled (so the parent can read/drive it), but
 * `onOpenChange` is now the *only* thing that sets it — passed straight
 * through to `Combobox`, so the trigger's own click/escape/outside-click
 * behavior works. `onInputValueChange` only updates the search text; it no
 * longer also decides open state, which was fighting the trigger (clicking
 * with an empty query did nothing, since nothing but that handler ever
 * called `setIsTagDropdownOpen(true)`, and typing-then-clearing the query
 * closed the dropdown mid-interaction).
 */
export function ControlledTagFilterDemo() {
  const [filterTag, setFilterTag] = useState<string[]>([]);
  const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);
  const [tagSearchQuery, setTagSearchQuery] = useState("");
  const anchorRef = useComboboxAnchor();

  const filteredOptions = TAG_OPTIONS.filter((tag) =>
    tag.toLowerCase().includes(tagSearchQuery.trim().toLowerCase()),
  );

  return (
    <Card>
      <CardContent className="max-w-sm">
        <p className="mb-2 text-sm font-medium">Tag</p>

        <Combobox
          multiple
          items={filteredOptions}
          value={filterTag}
          onValueChange={(next) => setFilterTag(next ?? [])}
          open={isTagDropdownOpen}
          onOpenChange={setIsTagDropdownOpen}
          inputValue={tagSearchQuery}
          onInputValueChange={(value) => setTagSearchQuery(value ?? "")}
        >
          <ComboboxChips ref={anchorRef}>
            <ComboboxChipsInput
              placeholder="Select tags"
              aria-label="Tag"
            />
          </ComboboxChips>

          <ComboboxContent anchor={anchorRef}>
            <ComboboxEmpty>No matching tags.</ComboboxEmpty>
            <ComboboxList>
              {filteredOptions.map((tagName) => (
                <ComboboxItem key={tagName} value={tagName}>
                  {tagName}
                </ComboboxItem>
              ))}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>

        {filterTag.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {filterTag.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setFilterTag(filterTag.filter((item) => item !== tag))}
                aria-label={`Remove ${tag}`}
                className="flex h-7 items-center gap-1 rounded-md bg-primary py-0.5 pr-1 pl-2.5 text-xs font-medium text-primary-foreground"
              >
                {tag}
                <XIcon className="size-3.5 opacity-70 hover:opacity-100" />
              </button>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
