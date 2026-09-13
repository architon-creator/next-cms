import { Router } from "express";
import { getDemoItems } from "../controllers/otel-demo.controller.js";

export const otelDemoRouter = Router();

otelDemoRouter.get("/", getDemoItems);
