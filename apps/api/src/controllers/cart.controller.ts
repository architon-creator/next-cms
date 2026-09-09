import type { Request, Response } from "express";
import type { Cart, CartItem } from "../types/cart.js";

// In-memory placeholder store, scoped to the whole process (not per-user/
// session). Swap for a real datastore (Redis/Postgres, keyed by session or
// user id) once auth/sessions exist — this is here so routes/controllers
// have something real to call while that's built out.
let cart: Cart = { items: [], total: 0 };

function recalculateTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

export function getCart(_req: Request, res: Response) {
  res.json(cart);
}

export function addItem(req: Request, res: Response) {
  const { id, name, price, quantity = 1 } = req.body as Partial<CartItem>;

  if (!id || !name || typeof price !== "number") {
    return res.status(400).json({ error: "id, name, and price are required" });
  }

  const existing = cart.items.find((item) => item.id === id);
  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.items.push({ id, name, price, quantity });
  }

  cart.total = recalculateTotal(cart.items);
  res.status(201).json(cart);
}

export function removeItem(req: Request, res: Response) {
  const { id } = req.params;
  cart.items = cart.items.filter((item) => item.id !== id);
  cart.total = recalculateTotal(cart.items);
  res.json(cart);
}

export function clearCart(_req: Request, res: Response) {
  cart = { items: [], total: 0 };
  res.status(204).send();
}
