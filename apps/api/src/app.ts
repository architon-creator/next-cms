import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { UPLOAD_DIR } from "./controllers/product-demo.controller.js";
import { authRouter } from "./routes/auth.routes.js";
import { cartRouter } from "./routes/cart.routes.js";
import { flightRouter } from "./routes/flight.routes.js";
import { otelDemoRouter } from "./routes/otel-demo.routes.js";
import { productDemoRouter } from "./routes/product-demo.routes.js";

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use("/uploads", express.static(UPLOAD_DIR));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Feature routers. Each new domain (payments, users, ...) gets its own
  // routes/*.routes.ts + controllers/*.controller.ts pair mounted here.
  app.use("/auth", authRouter);
  app.use("/cart", cartRouter);
  app.use("/flights", flightRouter);
  // OTel SSR/CSR tracing demo — see apps/frontend/app/[locale]/otel-demo.
  app.use("/demo/items", otelDemoRouter);
  // Multipart/form-data upload demo — see apps/frontend/app/[locale]/product-form-demo.
  app.use("/demo/products", productDemoRouter);

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: "Not found" });
  });

  // Express recognizes error-handling middleware by its 4-arg signature —
  // keep all four params even though `_next` is unused.
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
