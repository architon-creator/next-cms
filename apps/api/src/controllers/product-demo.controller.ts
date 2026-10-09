import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { createLogger } from "otel/logging";

const logger = createLogger("backend/product-demo");

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGES = 10;

// Served by express.static in app.ts. Swap storeFile() below for S3 /
// Prismic assets in a real endpoint; the controller only needs a URL back.
export const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
};

// Image ids come from the client and end up in a filename, so keep them to a
// safe charset (no path separators or dots).
const IMAGE_ID = /^[A-Za-z0-9_-]{1,64}$/;

async function storeFile(req: Request, id: string, file: Express.Multer.File) {
  await mkdir(UPLOAD_DIR, { recursive: true });
  // The id is part of the stored name, so each URL traces back to the exact
  // payload entry it came from, even if the same bytes were uploaded twice.
  const stored = `${id}-${randomUUID().slice(0, 8)}${EXTENSIONS[file.mimetype] ?? ""}`;
  await writeFile(path.join(UPLOAD_DIR, stored), file.buffer);
  return `${req.protocol}://${req.get("host")}/uploads/${stored}`;
}

// Deletes a file previously returned by storeFile(). Only the last path
// segment of the URL is used, so it can never point outside UPLOAD_DIR.
async function deleteStored(url: string) {
  try {
    const name = path.basename(new URL(url).pathname);
    await unlink(path.join(UPLOAD_DIR, name));
  } catch {
    // Already gone (or not ours): nothing to clean up.
  }
}

interface ImageEntry {
  image: string;
  description?: string;
}

interface ProductData {
  category: string;
  product: Record<string, unknown> & { productImage: ImageEntry[]; productPdf?: string };
}

// In-memory store: products live until the server restarts. Swap for a
// database in a real service.
const products = new Map<string, ProductData>();

// Memory storage hands us file.buffer; storeFile() persists it.
const upload = multer({
  storage: multer.memoryStorage(),
  // +1 for the optional productPdf part.
  limits: { fileSize: MAX_IMAGE_BYTES, files: MAX_IMAGES + 1 },
  fileFilter: (_req, file, cb) => {
    if (file.fieldname === "productPdf") {
      if (file.mimetype === "application/pdf") cb(null, true);
      else cb(new Error("Only PDF files are allowed for productPdf"));
    } else if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
});

// Parses the multipart body: the JSON `payload` field lands in req.body,
// the file parts in req.files, keyed by field name ({ productImage: [...],
// productPdf: [...] }). Wrapped so multer's own errors (too large, wrong
// type) become a 400 instead of the generic 500.
export function parseProductUpload(req: Request, res: Response, next: NextFunction) {
  const fields = [
    { name: "productImage", maxCount: MAX_IMAGES },
    { name: "productPdf", maxCount: 1 },
  ];
  upload.fields(fields)(req, res, (err: unknown) => {
    // Debug: what multer received. Remove once the request format is settled.
    console.log("[product-demo] content-type:", req.headers["content-type"]);
    console.log("[product-demo] text fields (req.body):", req.body);
    for (const file of Object.values(uploadedFiles(req)).flat()) {
      console.log("[product-demo] file part:", {
        fieldname: file.fieldname, // multipart field name -> "productImage" / "productPdf"
        originalname: file.originalname, // the part's filename -> our image id
        mimetype: file.mimetype,
        size: file.size, // bytes
        bufferBytes: file.buffer?.length,
        firstBytes: file.buffer?.subarray(0, 8).toString("hex"), // file signature, e.g. ffd8ff = JPEG
      });
    }
    if (err) console.log("[product-demo] multer error:", err);

    if (!err) return next();
    const message = err instanceof Error ? err.message : "Upload failed";
    logger.warn("Product upload rejected", { message });
    res.status(400).json({ success: false, error: message });
  });
}

// req.files is { [fieldname]: File[] } because upload.fields() is used.
function uploadedFiles(req: Request) {
  return (req.files as Record<string, Express.Multer.File[]> | undefined) ?? {};
}

interface ProductPayload {
  category?: unknown;
  product?: Record<string, unknown>;
}

// Express types a route param as string | string[]; ours is always a string.
const paramId = (req: Request) => {
  const value = req.params.id;
  return Array.isArray(value) ? value[0]! : (value ?? "");
};

const bad = (res: Response, error: string, extra: Record<string, unknown> = {}) =>
  res.status(400).json({ success: false, error, ...extra });

// Shared by create (existing === undefined) and update (existing = the stored
// product). Validates everything first, and only then writes/deletes files,
// so a rejected request never leaves the stored product half-changed.
async function saveProduct(req: Request, res: Response, existing: ProductData | undefined) {
  let payload: ProductPayload;
  try {
    payload = JSON.parse((req.body as { payload?: string }).payload ?? "") as ProductPayload;
  } catch {
    return bad(res, "`payload` must be valid JSON");
  }

  const { category, product } = payload;
  if (typeof category !== "string" || !category) return bad(res, "category is required");
  if (!product || typeof product.ssrCode !== "string" || !product.ssrCode) {
    return bad(res, "product.ssrCode is required");
  }
  if (typeof product.price !== "number" || !Number.isFinite(product.price) || product.price < 0) {
    return bad(res, "product.price must be a non-negative number");
  }

  const files = uploadedFiles(req).productImage ?? [];

  // product.productImage is a repeatable group: [{ image, description }].
  // `image` is either a NEW image id (must match the filename of exactly one
  // uploaded file part, so pairing never depends on order) or, on update, the
  // URL of one of this product's current images (kept as is, no file).
  const keptUrls = new Set((existing?.product.productImage ?? []).map((item) => item.image));
  const items = Array.isArray(product.productImage) ? product.productImage : [];
  const groups = items as { image?: unknown; description?: unknown }[];
  if (
    groups.some(
      (item) =>
        !item ||
        typeof item.image !== "string" ||
        !(IMAGE_ID.test(item.image) || keptUrls.has(item.image)) ||
        (item.description !== undefined && typeof item.description !== "string"),
    )
  ) {
    return bad(
      res,
      existing
        ? "product.productImage must be a list of { image, description } where image is a new id (letters, digits, - and _) or one of the product's current image URLs"
        : "product.productImage must be a list of { image, description } where image is an id (letters, digits, - and _)",
    );
  }
  const ids = groups.map((item) => item.image as string);
  if (new Set(ids).size !== ids.length) {
    return bad(res, "product.productImage contains duplicate image ids");
  }
  // The limit is on the product's total images (kept + new), not just the
  // files uploaded in this request.
  if (ids.length > MAX_IMAGES) {
    return bad(res, `Too many images (max ${MAX_IMAGES} per product)`);
  }
  const newIds = ids.filter((id) => !keptUrls.has(id));
  if (files.length === 0 && newIds.length === ids.length) {
    return bad(res, "At least one productImage is required");
  }

  const filesById = new Map(files.map((file) => [file.originalname, file]));
  if (filesById.size !== files.length) {
    return bad(res, "Uploaded productImage files have duplicate ids");
  }
  const missing = newIds.filter((id) => !filesById.has(id));
  const unreferenced = files.filter((file) => !newIds.includes(file.originalname));
  if (missing.length > 0 || unreferenced.length > 0) {
    return bad(res, "product.productImage ids and uploaded files do not match", {
      missingFiles: missing,
      unreferencedFiles: unreferenced.map((file) => file.originalname),
    });
  }

  // Optional single PDF. product.productPdf is one of:
  //   absent      -> no PDF (on update: removes the current one)
  //   current URL -> keep the stored PDF (update only; no file part)
  //   new id      -> must match the filename of the uploaded productPdf part
  const pdfFile = uploadedFiles(req).productPdf?.[0];
  const pdfValue = product.productPdf ?? undefined;
  const currentPdf = existing?.product.productPdf;
  const pdfMismatch = "product.productPdf id and the uploaded productPdf file do not match";
  let pdfAction: "none" | "keep" | "new" = "none";
  if (pdfValue === undefined) {
    if (pdfFile) return bad(res, pdfMismatch);
  } else if (typeof pdfValue === "string" && currentPdf !== undefined && pdfValue === currentPdf) {
    if (pdfFile) return bad(res, pdfMismatch);
    pdfAction = "keep";
  } else if (typeof pdfValue === "string" && IMAGE_ID.test(pdfValue)) {
    if (!pdfFile || pdfFile.originalname !== pdfValue) return bad(res, pdfMismatch);
    pdfAction = "new";
  } else {
    return bad(
      res,
      existing
        ? "product.productPdf must be a new id (letters, digits, - and _) or the product's current PDF URL"
        : "product.productPdf must be an id (letters, digits, - and _)",
    );
  }

  // ---- validation done: write new files, then delete the replaced ones.
  const productImage: ImageEntry[] = await Promise.all(
    groups.map(async (item) => {
      const id = item.image as string;
      if (keptUrls.has(id)) return { ...item } as ImageEntry;
      return { ...item, image: await storeFile(req, id, filesById.get(id)!) } as ImageEntry;
    }),
  );
  let productPdf: string | undefined;
  if (pdfAction === "keep") productPdf = currentPdf;
  if (pdfAction === "new") productPdf = await storeFile(req, pdfFile!.originalname, pdfFile!);

  if (existing) {
    const stillUsed = new Set(productImage.map((item) => item.image));
    const removed = [...keptUrls].filter((url) => !stillUsed.has(url));
    if (currentPdf !== undefined && pdfAction !== "keep") removed.push(currentPdf);
    await Promise.all(removed.map(deleteStored));
  }

  const { productPdf: _ignored, ...rest } = product;
  const data: ProductData = {
    category,
    product: { ...rest, productImage, ...(productPdf ? { productPdf } : {}) },
  };
  const id = existing ? paramId(req) : randomUUID();
  products.set(id, data);

  logger.info(existing ? "Product updated" : "Product received", {
    id,
    category,
    ssrCode: product.ssrCode,
    imageCount: productImage.length,
    hasPdf: Boolean(productPdf),
  });

  res.status(existing ? 200 : 201).json({ success: true, id, data });
}

export function createProduct(req: Request, res: Response) {
  return saveProduct(req, res, undefined);
}

export function updateProduct(req: Request, res: Response) {
  const existing = products.get(paramId(req));
  if (!existing) return res.status(404).json({ success: false, error: "Product not found" });
  return saveProduct(req, res, existing);
}

export function getProduct(req: Request, res: Response) {
  const data = products.get(paramId(req));
  if (!data) return res.status(404).json({ success: false, error: "Product not found" });
  res.json({ success: true, id: paramId(req), data });
}
