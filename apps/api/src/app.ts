import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { cartRouter } from "./routes/cart.routes.js";
import { flightRouter } from "./routes/flight.routes.js";

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Feature routers. Each new domain (payments, users, ...) gets its own
  // routes/*.routes.ts + controllers/*.controller.ts pair mounted here.
  app.use("/cart", cartRouter);
  app.use("/flights", flightRouter);

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
