import { ProductFormDemoClient } from "./product-form-demo-client";

export default function ProductFormDemoPage() {
  return (
    <div className="mx-auto flex max-w-[600px] flex-col gap-6 p-6">
      <div>
        <h1 className="text-3xl font-semibold">Product form demo</h1>
        <p className="text-sm text-muted-foreground">
          Click the image box to choose files. Submit sends the product as a JSON{" "}
          <code>payload</code> part plus the <code>productImage</code> files to the
          backend as <code>multipart/form-data</code>.
        </p>
      </div>
      <ProductFormDemoClient />
    </div>
  );
}
