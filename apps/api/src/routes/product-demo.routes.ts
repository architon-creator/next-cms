import { Router } from "express";
import {
  createProduct,
  getProduct,
  parseProductUpload,
  updateProduct,
} from "../controllers/product-demo.controller.js";

export const productDemoRouter = Router();

productDemoRouter.post("/", parseProductUpload, createProduct);
productDemoRouter.get("/:id", getProduct);
productDemoRouter.put("/:id", parseProductUpload, updateProduct);
