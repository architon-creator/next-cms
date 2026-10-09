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

// One item of the repeatable "Product image" group: an image plus its
// description. `id` is only an internal React key / bookkeeping id; it never
// leaves the browser. An item is either NEW (`file` set, uploaded on submit)
// or already STORED (`url` set after a save: kept as is on update, no
// re-upload). Picking a new file for a stored item replaces it.
type ImageItem = { id: string; file: File | null; url?: string; description: string };

const newItemId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `item-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

// The id sent to the backend: product-image-1, product-image-2, ... It goes
// into the payload AND is used as the multipart part's filename, so the
// backend matches file <-> payload item by id instead of by position. It is
// derived from the item's position at submit time, so it stays sequential
// after items are removed. Even the same picture in two items gets two ids.
const imageWireId = (index: number) => `product-image-${index + 1}`;

// Builds the exact JSON shape the backend expects. Each `productImage` item
// holds an image id and a description; the backend swaps the id for the
// stored image URL.
function buildPayload(
  s: FormState,
  images: ImageItem[],
  pdf: File | null,
  pdfUrl: string | null,
) {
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
      productImage: images.map((image, index) => ({
        // Stored items send their current URL (keep); new ones send a new id.
        image: image.url ?? imageWireId(index),
        description: image.description,
      })),
      // New PDF: an id here, and the same id as the PDF part's filename.
      // Stored PDF: its current URL (keep). Neither: left out (undefined is
      // dropped by JSON.stringify), which removes the PDF on update.
      productPdf: pdf ? PDF_WIRE_ID : (pdfUrl ?? undefined),
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

const MAX_IMAGES = 10; // matches the API's multer limit
const PDF_WIRE_ID = "product-pdf";

type SavedProduct = {
  productImage?: { image: string; description?: string }[];
  productPdf?: string;
};

type ApiResponse = {
  success: boolean;
  error?: string;
  id?: string;
  data?: { product?: SavedProduct };
  [key: string]: unknown;
};

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
  const [images, setImages] = useState<ImageItem[]>([]);
  const [pdf, setPdf] = useState<File | null>(null);
  // Set once a product has been saved: from then on Submit updates it.
  const [productId, setProductId] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  // Which group item the shared hidden file input is currently picking for.
  const pickingFor = useRef<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ApiResponse | null>(null);

  // One blob: preview URL per File, created once and reused across renders.
  // Re-creating URLs on every change (e.g. each keystroke in a description)
  // gives the <img> a new src and makes the browser re-load every image.
  const previewUrls = useRef(new Map<File, string>());
  const previewFor = (file: File | null) => {
    if (!file) return null;
    let url = previewUrls.current.get(file);
    if (!url) {
      url = URL.createObjectURL(file);
      previewUrls.current.set(file, url);
    }
    return url;
  };

  // Free the URL of any file that is no longer in the list (item removed or
  // its image replaced).
  useEffect(() => {
    const live = new Set(images.map((image) => image.file));
    for (const [file, url] of previewUrls.current) {
      if (!live.has(file)) {
        URL.revokeObjectURL(url);
        previewUrls.current.delete(file);
      }
    }
  }, [images]);

  // Free everything on unmount. The map is cleared too so a re-mount
  // (StrictMode in dev) never reuses a revoked URL.
  useEffect(() => {
    const cache = previewUrls.current;
    return () => {
      cache.forEach((url) => URL.revokeObjectURL(url));
      cache.clear();
    };
  }, []);

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

  // After a save, show what the server stored: every image becomes a STORED
  // item (url set, no file) and the PDF becomes a stored URL. Further edits
  // then keep, replace or remove them on the next submit.
  function showSaved(id: string, product: SavedProduct | undefined) {
    setProductId(id);
    setImages(
      (product?.productImage ?? []).map((item) => ({
        id: newItemId(),
        file: null,
        url: item.image,
        description: item.description ?? "",
      })),
    );
    setPdf(null);
    setPdfUrl(product?.productPdf ?? null);
  }

  function startNewProduct() {
    setProductId(null);
    setImages([]);
    setPdf(null);
    setPdfUrl(null);
    setResult(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (images.length === 0 || images.some((image) => !image.file && !image.url)) {
      setResult({
        success: false,
        error: "Add at least one product image item, and choose an image for every item",
      });
      return;
    }

    const formData = new FormData();
    formData.set("payload", JSON.stringify(buildPayload(state, images, pdf, pdfUrl)));
    // Only NEW images are uploaded. Third argument = filename on the wire = the
    // image id used in the payload. Stored items travel as their URL only.
    images.forEach(({ file, url }, index) => {
      if (file && !url) formData.append("productImage", file, imageWireId(index));
    });
    if (pdf) formData.append("productPdf", pdf, PDF_WIRE_ID);

    setSubmitting(true);
    setResult(null);
    try {
      // No Content-Type header: the browser adds multipart/form-data with the
      // correct boundary itself.
      const response = await fetch(
        productId ? `/api/product-demo/${encodeURIComponent(productId)}` : "/api/product-demo",
        { method: productId ? "PUT" : "POST", body: formData },
      );
      const body = (await response.json()) as ApiResponse;
      setResult(body);
      if (body.success && body.id) showSaved(body.id, body.data?.product);
    } catch (err) {
      setResult({ success: false, error: err instanceof Error ? err.message : String(err) });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {productId && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 p-3 text-sm">
          <span className="min-w-0 truncate">
            Editing saved product <code className="font-mono text-xs">{productId}</code> — Submit
            will update it.
          </span>
          <Button type="button" variant="outline" size="sm" onClick={startNewProduct}>
            New product
          </Button>
        </div>
      )}

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
        <div className="flex items-center justify-between">
          <Label>
            Product image ({images.length}/{MAX_IMAGES})
          </Label>
          <Button
            type="button"
            variant="outline"
            disabled={images.length >= MAX_IMAGES}
            onClick={() =>
              setImages((prev) => [...prev, { id: newItemId(), file: null, description: "" }])
            }
          >
            Add item
          </Button>
        </div>

        {/* One hidden input shared by every item; pickingFor says whose it is. */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null;
            const target = pickingFor.current;
            if (file && target) {
              setImages((prev) =>
                prev.map((item) =>
                  item.id === target ? { ...item, file, url: undefined } : item,
                ),
              );
            }
            // Reset so picking the same file again still fires onChange.
            e.target.value = "";
          }}
        />

        {images.length === 0 && (
          <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            No items yet. Click &quot;Add item&quot; to add a product image with a description.
          </p>
        )}

        {images.map((image, i) => (
          <div key={image.id} className="flex flex-col gap-2 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Item {i + 1}</span>
              <Button
                type="button"
                variant="destructive"
                size="xs"
                onClick={() => setImages((prev) => prev.filter((item) => item.id !== image.id))}
              >
                Remove item
              </Button>
            </div>

            <button
              type="button"
              onClick={() => {
                pickingFor.current = image.id;
                fileInputRef.current?.click();
              }}
              className="flex h-32 w-full items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-muted/30 text-sm text-muted-foreground hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {image.url ? (
                // eslint-disable-next-line @next/next/no-img-element -- stored image served by the API (another origin)
                <img src={image.url} alt={`Item ${i + 1}`} className="h-full w-full object-contain" />
              ) : image.file ? (
                // eslint-disable-next-line @next/next/no-img-element -- local blob: preview, next/image can't optimize it
                <img src={previewFor(image.file)!} alt={image.file.name} className="h-full w-full object-contain" />
              ) : (
                "Click to choose an image"
              )}
            </button>
            <p className="font-mono text-[10px] text-muted-foreground">
              {image.url
                ? "stored image (click to replace)"
                : `${image.file ? `${image.file.name} · ` : ""}new, id: ${imageWireId(i)}`}
            </p>

            <textarea
              aria-label={`Description for item ${i + 1}`}
              placeholder="Description"
              rows={2}
              value={image.description}
              onChange={(e) =>
                setImages((prev) =>
                  prev.map((item) =>
                    item.id === image.id ? { ...item, description: e.target.value } : item,
                  ),
                )
              }
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <Label>Product PDF (optional)</Label>
        <input
          ref={pdfInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            setPdf(e.target.files?.[0] ?? null);
            // Reset so picking the same file again still fires onChange.
            e.target.value = "";
          }}
        />
        <div className="flex items-center gap-2 rounded-lg border border-border p-3">
          <Button type="button" variant="outline" onClick={() => pdfInputRef.current?.click()}>
            {pdf || pdfUrl ? "Change PDF" : "Choose PDF"}
          </Button>
          <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
            {pdf ? (
              `${pdf.name} · ${(pdf.size / 1024).toFixed(1)} KB (new)`
            ) : pdfUrl ? (
              <a href={pdfUrl} target="_blank" rel="noreferrer" className="underline">
                Stored PDF (open)
              </a>
            ) : (
              "No PDF chosen"
            )}
          </span>
          {(pdf || pdfUrl) && (
            <Button
              type="button"
              variant="destructive"
              size="xs"
              onClick={() => {
                setPdf(null);
                setPdfUrl(null);
              }}
            >
              Remove
            </Button>
          )}
        </div>
      </div>

      <Button type="submit" disabled={submitting}>
        {submitting ? "Submitting…" : productId ? "Update product" : "Submit"}
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
