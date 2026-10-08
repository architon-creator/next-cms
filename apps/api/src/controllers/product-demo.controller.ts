import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { createLogger } from "otel/logging";

const logger = createLogger("backend/product-demo");

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGES = 10;

// Served by express.static in app.ts. Swap storeImage() below for S3 /
// Prismic assets in a real endpoint; the controller only needs a URL back.
export const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");

async function storeImage(req: Request, file: Express.Multer.File) {
  await mkdir(UPLOAD_DIR, { recursive: true });
  const ext = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, "");
  const stored = `${randomUUID()}${ext}`;
  await writeFile(path.join(UPLOAD_DIR, stored), file.buffer);
  return `${req.protocol}://${req.get("host")}/uploads/${stored}`;
}

// Memory storage hands us file.buffer; storeImage() persists it.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: MAX_IMAGES },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
});

// Parses the multipart body: the JSON `payload` field lands in req.body,
// the `productImage` parts in req.files. Wrapped so multer's own errors
// (too large, wrong type) become a 400 instead of the generic 500.
export function parseProductUpload(req: Request, res: Response, next: NextFunction) {
  upload.array("productImage", MAX_IMAGES)(req, res, (err: unknown) => {
    if (!err) return next();
    const message = err instanceof Error ? err.message : "Upload failed";
    logger.warn("Product upload rejected", { message });
    res.status(400).json({ success: false, error: message });
  });
}

interface ProductPayload {
  category?: unknown;
  product?: Record<string, unknown>;
}

export async function createProduct(req: Request, res: Response) {
  let payload: ProductPayload;
  try {
    payload = JSON.parse((req.body as { payload?: string }).payload ?? "") as ProductPayload;
  } catch {
    return res.status(400).json({ success: false, error: "`payload` must be valid JSON" });
  }

  const { category, product } = payload;
  if (typeof category !== "string" || !category) {
    return res.status(400).json({ success: false, error: "category is required" });
  }
  if (!product || typeof product.ssrCode !== "string" || !product.ssrCode) {
    return res.status(400).json({ success: false, error: "product.ssrCode is required" });
  }
  if (typeof product.price !== "number" || !Number.isFinite(product.price) || product.price < 0) {
    return res
      .status(400)
      .json({ success: false, error: "product.price must be a non-negative number" });
  }

  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (files.length === 0) {
    return res.status(400).json({ success: false, error: "At least one productImage is required" });
  }

  const names = Array.isArray(product.productImage) ? product.productImage : [];
  if (names.length !== files.length) {
    return res.status(400).json({
      success: false,
      error: "product.productImage must list one file name per uploaded image",
    });
  }

  // Names in the payload map to the file parts by position.
  const productImage = await Promise.all(files.map((file) => storeImage(req, file)));

  logger.info("Product received", {
    category,
    ssrCode: product.ssrCode,
    imageCount: files.length,
  });

  res.status(201).json({
    success: true,
    data: { category, product: { ...product, productImage } },
  });
}
