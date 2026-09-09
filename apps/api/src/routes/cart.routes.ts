import { Router } from "express";
import {
  addItem,
  clearCart,
  getCart,
  removeItem,
} from "../controllers/cart.controller.js";

export const cartRouter = Router();

cartRouter.get("/", getCart);
cartRouter.post("/items", addItem);
cartRouter.delete("/items/:id", removeItem);
cartRouter.delete("/", clearCart);
