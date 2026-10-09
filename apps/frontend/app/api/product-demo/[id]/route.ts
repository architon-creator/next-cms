import { NextRequest, NextResponse } from "next/server";

import { apiUnreachable, productApiBaseUrl } from "@/lib/product-demo-api";

// In this Next version a route handler's `params` is a Promise.
type Context = { params: Promise<{ id: string }> };

const target = (id: string) => `${productApiBaseUrl()}/demo/products/${encodeURIComponent(id)}`;

// GET /api/product-demo/:id -> the stored product.
export async function GET(_request: NextRequest, { params }: Context) {
  try {
    const { id } = await params;
    const apiResponse = await fetch(target(id), { cache: "no-store" });
    return NextResponse.json(await apiResponse.json(), { status: apiResponse.status });
  } catch (err) {
    return apiUnreachable(err);
  }
}

// PUT /api/product-demo/:id -> update. Same multipart body as create; each
// productImage[].image is a new image id (with a file part) or the URL of a
// current image to keep. See the OpenAPI spec for the full rules.
export async function PUT(request: NextRequest, { params }: Context) {
  try {
    const { id } = await params;
    const formData = await request.formData();
    const apiResponse = await fetch(target(id), {
      method: "PUT",
      body: formData,
      cache: "no-store",
    });
    return NextResponse.json(await apiResponse.json(), { status: apiResponse.status });
  } catch (err) {
    return apiUnreachable(err);
  }
}
