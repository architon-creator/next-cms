import { Router } from "express";
import {
  createProduct,
  parseProductUpload,
} from "../controllers/product-demo.controller.js";

export const productDemoRouter = Router();

productDemoRouter.post("/", parseProductUpload, createProduct);
