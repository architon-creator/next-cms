import { ControlledTagFilterDemo } from "./controlled-tag-filter-demo";
import { TagComboboxDemoClient } from "./tag-combobox-demo-client";

export default function TagComboboxDemoPage() {
  return (
    <div className="mx-auto flex max-w-[700px] flex-col gap-10 p-6">
      <div>
        <h1 className="text-3xl font-semibold">Tag combobox demo</h1>
        <p className="text-sm text-muted-foreground">
          A multi-select tag picker built on <code>@base-ui/react</code>&apos;s{" "}
          <code>Combobox</code>, with selections shown as a removable row below the
          input.
        </p>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">TagCombobox (uncontrolled)</h2>
        <TagComboboxDemoClient />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Controlled open/search state (fixed)</h2>
        <p className="text-sm text-muted-foreground">
          Same shape as the real project&apos;s filter-bar usage — <code>open</code> is
          still externally controlled — but <code>onOpenChange</code> alone drives it
          now, so clicking the trigger with an empty query opens it.
        </p>
        <ControlledTagFilterDemo />
      </section>
    </div>
  );
}
