"use client";

import { useState } from "react";

import { Card, CardContent, TagCombobox } from "ui";

const TAGS = ["Halal", "Drink", "Set", "Chicken"];

export function TagComboboxDemoClient() {
  const [tags, setTags] = useState<string[]>(["Halal"]);

  return (
    <Card>
      <CardContent className="max-w-sm">
        <TagCombobox label="Tag" tags={TAGS} value={tags} onChange={setTags} />

        <p className="mt-4 text-sm text-muted-foreground">
          Selected: {tags.length > 0 ? tags.join(", ") : "none"}
        </p>
      </CardContent>
    </Card>
  );
}
