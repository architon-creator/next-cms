"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";

import { Button, Input, Label } from "ui";

type PreOrderLimitRow = { withinHour: string; targetAirRoutes: string };

type FormState = {
  ssrCode: string;
  priceModel: string;
  tags: string;
  saleStartDate: string;
  saleEndDate: string;
  applicationStartDate: string;
  applicationEndDate: string;
  price: string;
  currency: string;
  visibleOnWeb: boolean;
  setDiscountRate: string;
  paidMemberDiscountContent: string;
  annualDiscountRate: string;
  setType: string;
  capacity: string;
  capacityUnit: string;
  weight: string;
  weightUnit: string;
  recommend: boolean;
  akibaZip: boolean;
  pickupLocation: string;
  presetHealthInformation: string;
  allergyInformation: string;
  displayOrder: string;
  orderForServicePage: string;
  priceForServicePage: string;
  currencyForServicePage: string;
  preOrderLimit: PreOrderLimitRow[];
};

const initialState: FormState = {
  ssrCode: "DRAB",
  priceModel: "DRAB_0",
  tags: "1, 2",
  saleStartDate: "2026-08-01T00:00:00",
  saleEndDate: "2026-08-31T23:59:59",
  applicationStartDate: "2026-08-01T00:00:00",
  applicationEndDate: "2026-12-31T23:59:59",
  price: "500",
  currency: "JPY",
  visibleOnWeb: true,
  setDiscountRate: "10",
  paidMemberDiscountContent: "offer",
  annualDiscountRate: "10",
  setType: "Parent",
  capacity: "2",
  capacityUnit: "g",
  weight: "5",
  weightUnit: "g",
  recommend: false,
  akibaZip: false,
  pickupLocation: "Onboard",
  presetHealthInformation: "calories:350,sodium:450,sugars:12",
  allergyInformation: "eggs, milk, wheat",
  displayOrder: "1",
  orderForServicePage: "10",
  priceForServicePage: "500",
  currencyForServicePage: "JPY",
  preOrderLimit: [{ withinHour: "24", targetAirRoutes: "NRT-BKK, BKK-NRT, NRT-ICN" }],
};

const splitList = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

// <input type="datetime-local"> yields "2026-08-01T00:00:00"; the backend
// format is "2026-08-01 00:00:00". Browsers drop ":00" seconds, so re-pad.
const toApiDate = (value: string) => {
  const [date, time = "00:00:00"] = value.split("T");
  return `${date} ${time.length === 5 ? `${time}:00` : time}`;
};

// Builds the exact JSON shape the backend expects. `productImage` holds the
// selected files' names, in the same order as the `productImage` multipart
// file parts; the backend swaps each name for the stored image URL.
function buildPayload(s: FormState, files: File[]) {
  return {
    category: "InflightMeal",
    product: {
      ssrCode: s.ssrCode,
      priceModel: s.priceModel,
      tags: splitList(s.tags).map(Number),
      saleStartDate: toApiDate(s.saleStartDate),
      saleEndDate: toApiDate(s.saleEndDate),
      applicationStartDate: toApiDate(s.applicationStartDate),
      applicationEndDate: toApiDate(s.applicationEndDate),
      price: Number(s.price),
      currency: s.currency,
      visibleOnWeb: s.visibleOnWeb,
      setDiscountRate: Number(s.setDiscountRate),
      paidMemberDiscountContent: s.paidMemberDiscountContent,
      annualDiscountRate: Number(s.annualDiscountRate),
      setType: s.setType,
      capacity: Number(s.capacity),
      capacityUnit: s.capacityUnit,
      weight: Number(s.weight),
      weightUnit: s.weightUnit,
      recommend: s.recommend,
      akibaZip: s.akibaZip,
      pickupLocation: s.pickupLocation,
      productImage: files.map((file) => file.name),
      presetHealthInformation: s.presetHealthInformation,
      allergyInformation: splitList(s.allergyInformation),
      displayOrder: Number(s.displayOrder),
      orderForServicePage: Number(s.orderForServicePage),
      priceForServicePage: Number(s.priceForServicePage),
      currencyForServicePage: s.currencyForServicePage,
      preOrderLimit: s.preOrderLimit.map((row) => ({
        withinHour: Number(row.withinHour),
        targetAirRoutes: splitList(row.targetAirRoutes),
      })),
    },
  };
}

type ApiResponse = { success: boolean; error?: string; [key: string]: unknown };

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

export function ProductFormDemoClient() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<FormState>(initialState);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ApiResponse | null>(null);

  // Object URLs hold the files in memory until revoked.
  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setState((prev) => ({ ...prev, [key]: value }));

  const text = (key: keyof FormState, type = "text") => (
    <Input
      type={type}
      value={state[key] as string}
      onChange={(e) => set(key, e.target.value as never)}
      step={type === "datetime-local" ? 1 : undefined}
      required
    />
  );

  const check = (key: "visibleOnWeb" | "recommend" | "akibaZip", label: string) => (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={state[key]}
        onChange={(e) => set(key, e.target.checked)}
      />
      {label}
    </label>
  );

  function updateRow(index: number, patch: Partial<PreOrderLimitRow>) {
    set(
      "preOrderLimit",
      state.preOrderLimit.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (files.length === 0) {
      setResult({ success: false, error: "Please choose at least one product image" });
      return;
    }

    const formData = new FormData();
    formData.set("payload", JSON.stringify(buildPayload(state, files)));
    files.forEach((file) => formData.append("productImage", file));

    setSubmitting(true);
    setResult(null);
    try {
      // No Content-Type header: the browser adds multipart/form-data with the
      // correct boundary itself.
      const response = await fetch("/api/product-demo", { method: "POST", body: formData });
      setResult((await response.json()) as ApiResponse);
    } catch (err) {
      setResult({ success: false, error: err instanceof Error ? err.message : String(err) });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="SSR code">{text("ssrCode")}</Field>
        <Field label="Price model">{text("priceModel")}</Field>
        <Field label="Tags (comma separated numbers)">{text("tags")}</Field>
        <Field label="Set type">{text("setType")}</Field>
        <Field label="Sale start">{text("saleStartDate", "datetime-local")}</Field>
        <Field label="Sale end">{text("saleEndDate", "datetime-local")}</Field>
        <Field label="Application start">{text("applicationStartDate", "datetime-local")}</Field>
        <Field label="Application end">{text("applicationEndDate", "datetime-local")}</Field>
        <Field label="Price">{text("price", "number")}</Field>
        <Field label="Currency">{text("currency")}</Field>
        <Field label="Set discount rate">{text("setDiscountRate", "number")}</Field>
        <Field label="Annual discount rate">{text("annualDiscountRate", "number")}</Field>
        <Field label="Paid member discount content">{text("paidMemberDiscountContent")}</Field>
        <Field label="Pickup location">{text("pickupLocation")}</Field>
        <Field label="Capacity">{text("capacity", "number")}</Field>
        <Field label="Capacity unit">{text("capacityUnit")}</Field>
        <Field label="Weight">{text("weight", "number")}</Field>
        <Field label="Weight unit">{text("weightUnit")}</Field>
        <Field label="Display order">{text("displayOrder", "number")}</Field>
        <Field label="Order for service page">{text("orderForServicePage", "number")}</Field>
        <Field label="Price for service page">{text("priceForServicePage", "number")}</Field>
        <Field label="Currency for service page">{text("currencyForServicePage")}</Field>
      </div>

      <div className="flex gap-6">
        {check("visibleOnWeb", "Visible on web")}
        {check("recommend", "Recommend")}
        {check("akibaZip", "Akiba ZIP")}
      </div>

      <Field label="Preset health information">{text("presetHealthInformation")}</Field>
      <Field label="Allergy information (comma separated)">{text("allergyInformation")}</Field>

      <div className="flex flex-col gap-2">
        <Label>Pre-order limit</Label>
        {state.preOrderLimit.map((row, i) => (
          <div key={i} className="flex gap-2">
            <Input
              className="w-28"
              type="number"
              placeholder="Within hour"
              value={row.withinHour}
              onChange={(e) => updateRow(i, { withinHour: e.target.value })}
              required
            />
            <Input
              placeholder="Routes, e.g. NRT-BKK, BKK-NRT"
              value={row.targetAirRoutes}
              onChange={(e) => updateRow(i, { targetAirRoutes: e.target.value })}
              required
            />
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                set(
                  "preOrderLimit",
                  state.preOrderLimit.filter((_, j) => j !== i),
                )
              }
            >
              Remove
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          className="self-start"
          onClick={() =>
            set("preOrderLimit", [...state.preOrderLimit, { withinHour: "", targetAirRoutes: "" }])
          }
        >
          Add pre-order limit
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Product images</Label>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex min-h-40 w-full flex-wrap items-center justify-center gap-2 overflow-hidden rounded-lg border border-dashed border-border bg-muted/30 p-2 text-sm text-muted-foreground hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          {previews.length > 0
            ? previews.map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element -- local blob: preview, next/image can't optimize it
                <img key={src} src={src} alt={files[i]?.name ?? "Product"} className="h-32 object-contain" />
              ))
            : "Click to upload images"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
        />
        {files.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {files.map((f) => `${f.name} (${(f.size / 1024).toFixed(1)} KB)`).join(", ")}
          </p>
        )}
      </div>

      <Button type="submit" disabled={submitting}>
        {submitting ? "Submitting…" : "Submit"}
      </Button>

      {result && (
        <pre
          className={`overflow-x-auto rounded-lg border p-3 text-xs ${
            result.success ? "border-border bg-muted/30" : "border-destructive text-destructive"
          }`}
        >
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </form>
  );
}
